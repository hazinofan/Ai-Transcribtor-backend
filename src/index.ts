import { onCall } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import * as admin from 'firebase-admin';
import ytdlp from 'yt-dlp-exec';
import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config();

setGlobalOptions({
    timeoutSeconds: 300,
    memory: '1GiB',
    region: 'us-central1',
});

ffmpeg.setFfmpegPath(ffmpegPath!);
admin.initializeApp();

type ProcessVideoInput = {
    videoId: string;
    url: string;
    targetLanguage: 'en' | 'fr';
};

export const processVideo = onCall<ProcessVideoInput>(
    { cors: true },
    async (request) => {
        const { videoId, url, targetLanguage } = request.data;

        if (!videoId || !url || !targetLanguage) {
            throw new Error('invalid-argument: Missing videoId, url, or targetLanguage');
        }

        const langName = targetLanguage === 'fr' ? 'français' : 'anglais';
        const langCode = targetLanguage === 'fr' ? 'fr' : 'en';

        console.log(`🎬 Processing video ${videoId} (${langCode})`);

        const outputPath = path.join('/tmp', `${videoId}.mp3`);
        console.log(`🔊 Downloading audio to: ${outputPath}`);

        try {
            await ytdlp(url, {
                extractAudio: true,
                audioFormat: 'mp3',
                output: outputPath,
                ffmpegLocation: ffmpegPath!,
            });

            console.log('✅ Audio downloaded');

            const audioBuffer = fs.readFileSync(outputPath);
            console.log(`📦 Audio buffer size: ${audioBuffer.length} bytes`);

            const prompt = `
            Tu es un expert en transcription arabe avec Tashkīl et traduction.

            Ta tâche :
            1. Transcrire l’audio en arabe avec **Tashkīl complet**.
            2. Ajouter un **timestamp [mm:ss]** pour chaque phrase.
            3. Traduire chaque phrase en **${langName}** juste après la phrase arabe.

            ⚠️ Utilise **exactement** ce format pour chaque segment :

            [timestamp]
            Texte arabe avec Tashkīl
            Traduction en ${langName}

            Exemple :
            [00:00]
            كِتَابٌ أُنزِلَ إِلَيْكَ فَاسْتَمِعُوا لَهُ وَأَنصِتُوا
            ${langName === 'français'
                                ? "Un Livre qui vous a été envoyé, alors écoutez-le et soyez attentifs."
                                : "A Book that was sent to you, so listen to it and pay attention."}

            Continue avec le reste de la vidéo sans sauter de phrases. Ne retourne aucun texte hors format.
            DO NOT OMIT THE DIACRITICS. THIS IS A STRICT REQUIREMENT.

            Réponds uniquement avec un objet JSON (si nécessaire, entoure-le avec \`\`\`json ... \`\`\`)
            `;

            const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY || '');
            const model = genAI.getGenerativeModel({
                model: 'gemini-1.5-pro',
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 2048,
                },
            });

            const stream = await model.generateContentStream([
                {
                    fileData: {
                        fileUri: url,
                        mimeType: 'video/youtube',
                    },
                },
                prompt,
            ]);

            let raw = '';
            for await (const chunk of stream.stream) {
                raw += chunk.text();
            }

            console.log('📝 Gemini raw stream output:\n', raw);

            let parsedOutput = null;
            try {
                const match = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/```([\s\S]*?)```/);
                const jsonText = match ? match[1] : raw;
                parsedOutput = JSON.parse(jsonText);
            } catch (err) {
                console.warn('⚠️ Could not parse Gemini streamed output as JSON. Returning raw text.');
            }

            return {
                status: 'transcribed',
                videoId,
                output: parsedOutput ?? raw,
            };
        } catch (err: any) {
            console.error('❌ Error processing video:', err.message);
            throw new Error('internal: Video processing failed');
        }
    }
);
