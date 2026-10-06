const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const VIDEOS_DIR = path.join(__dirname, '..', 'vídeos');

// Serve static videos
app.use('/videos', express.static(VIDEOS_DIR));

app.post('/api/download', async (req, res) => {
    let { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ success: false, message: 'URL não fornecida.' });
    }
    
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
        return res.status(400).json({ success: false, message: 'Por favor, forneça um link válido do YouTube.' });
    }

    try {
        const isWin = process.platform === 'win32';
        const ytDlpPath = isWin ? '.\\yt-dlp.exe' : './yt-dlp';
        const ffmpegFlag = isWin ? '--ffmpeg-location ".\\mtool.exe"' : '';

        // 1. Obter informações do vídeo com yt-dlp
        const cmdJSON = `${ytDlpPath} --dump-json --no-warnings --no-check-certificates "${url}"`;
        const { stdout } = await execPromise(cmdJSON, { maxBuffer: 10 * 1024 * 1024 });
        const info = JSON.parse(stdout);
        
        const title = info.title.replace(/[\/\?<>\\:\*\|"]/g, '').replace(/[ ]+/g, '_');
        const filename = `${title}.mp4`;
        const filepath = path.join(VIDEOS_DIR, filename);

        if (fs.existsSync(filepath)) {
            return res.json({ success: true, message: 'Vídeo já baixado.', filename });
        }

        // 2. Baixar o vídeo (melhor vídeo e áudio, o ffmpeg que instalei agora vai juntar eles)
        const cmdDownload = `${ytDlpPath} --quiet --no-warnings ${ffmpegFlag} -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 -o "${filepath}" --no-check-certificates "${url}"`;
        await execPromise(cmdDownload, { maxBuffer: 10 * 1024 * 1024 });

        res.json({ success: true, message: 'Vídeo baixado com sucesso!', filename });

    } catch (error) {
        console.error('Download error:', error);
        
        let errorMessage = error.stderr || error.message;
        
        // Traduções amigáveis para erros comuns
        if (errorMessage.includes('Incomplete YouTube ID') || errorMessage.includes('truncated')) {
            errorMessage = 'O ID do vídeo está incompleto. Verifique se copiou a URL inteira (faltam caracteres).';
        } else if (errorMessage.includes('Video unavailable')) {
            errorMessage = 'Este vídeo não está disponível (pode ter sido apagado ou é privado).';
        } else if (errorMessage.includes('Sign in to confirm your age')) {
            errorMessage = 'Este vídeo tem restrição de idade e não pode ser baixado anonimamente.';
        } else {
            // Limpa o erro para não mostrar coisas feias do terminal, pega só a linha de erro do youtube
            const match = errorMessage.match(/ERROR: \[youtube\] [^:]+: (.*)/);
            if (match) errorMessage = match[1];
            else errorMessage = errorMessage.split('\n').find(l => l.includes('ERROR:')) || errorMessage;
        }

        res.status(500).json({ success: false, message: `Erro: ${errorMessage}` });
    }
});

app.get('/api/videos', (req, res) => {
    fs.readdir(VIDEOS_DIR, (err, files) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Erro ao ler a pasta de vídeos.' });
        }
        const videos = files.filter(file => file.endsWith('.mp4') || file.endsWith('.webm') || file.endsWith('.mkv'));
        res.json({ success: true, videos });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
