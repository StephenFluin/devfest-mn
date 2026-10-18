import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import montserrat400 from '@fontsource/montserrat/files/montserrat-latin-400-normal.woff';
import montserrat700 from '@fontsource/montserrat/files/montserrat-latin-700-normal.woff';
import { environment } from './environments/environment';

/**
 * 1200x630 social share card for a speaker: photo, name, company, talk, and the event date over
 * the site's hero photo. Laid out by satori (which draws text as shapes, so no system fonts are
 * needed) and rasterized by resvg; both run as WebAssembly bundled into the server.
 */
export interface CardSpeaker {
    name: string;
    company?: string;
    imageUrl?: string;
    talks: string[];
}

const WIDTH = 1200;
const HEIGHT = 630;

let ready: Promise<{ hero: string; logo: string }> | undefined;

/** Loads the renderer and the images every card uses, once per server. */
function setup(imagesFolder: string) {
    ready ??= (async () => {
        await initWasm(resvgWasm);
        const [hero, logo] = await Promise.all([
            readFile(join(imagesFolder, 'hero-cover.jpg')),
            readFile(join(imagesFolder, 'devfestmn.svg')),
        ]);
        return {
            hero: `data:image/jpeg;base64,${hero.toString('base64')}`,
            logo: `data:image/svg+xml;base64,${logo.toString('base64')}`,
        };
    })().catch((error) => {
        ready = undefined;
        throw error;
    });
    return ready;
}

/** The speaker's photo as a data URI, or undefined if it can't be fetched quickly. */
async function photo(url: string | undefined) {
    if (!url) return undefined;
    try {
        const absolute = url.startsWith('/') ? `${environment.siteUrl}${url}` : url;
        const response = await fetch(absolute, { signal: AbortSignal.timeout(5000) });
        const type = response.headers.get('content-type') ?? '';
        if (!response.ok || !/^image\/(jpeg|png|gif|webp)/.test(type)) return undefined;
        return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`;
    } catch {
        return undefined;
    }
}

/** A satori element; satori takes React-style element objects, so no JSX is needed. */
const el = (type: string, style: Record<string, unknown>, children?: unknown, props = {}) => ({
    type,
    props: { style, children, ...props },
});

export async function renderSpeakerCard(speaker: CardSpeaker, imagesFolder: string) {
    const [{ hero, logo }, face] = await Promise.all([setup(imagesFolder), photo(speaker.imageUrl)]);

    const text = [
        el('div', { fontSize: 58, fontWeight: 700, color: '#111' }, speaker.name),
        speaker.company && el('div', { fontSize: 32, color: '#444', marginTop: 4 }, speaker.company),
        speaker.talks.length &&
            el(
                'div',
                { fontSize: 36, color: '#0066cc', marginTop: 24 },
                `“${speaker.talks.join('” and “')}”`
            ),
    ].filter(Boolean);

    const card = el(
        'div',
        {
            width: WIDTH,
            height: HEIGHT,
            display: 'flex',
            position: 'relative',
            fontFamily: 'Montserrat',
            backgroundColor: '#fff',
        },
        [
            el('img', { position: 'absolute', width: WIDTH, height: HEIGHT, objectFit: 'cover' }, undefined, {
                src: hero,
            }),
            el('div', {
                position: 'absolute',
                width: WIDTH,
                height: HEIGHT,
                backgroundColor: 'rgba(255,255,255,0.82)',
            }),
            el('img', { position: 'absolute', left: 60, top: 36, width: 126, height: 110 }, undefined, {
                src: logo,
            }),
            el(
                'div',
                {
                    position: 'absolute',
                    left: 80,
                    right: 60,
                    top: 150,
                    bottom: 90,
                    display: 'flex',
                    alignItems: 'center',
                },
                [
                    face &&
                        el(
                            'img',
                            {
                                width: 340,
                                height: 340,
                                borderRadius: 170,
                                objectFit: 'cover',
                                marginRight: 50,
                            },
                            undefined,
                            { src: face }
                        ),
                    el('div', { display: 'flex', flexDirection: 'column', flex: 1 }, text),
                ].filter(Boolean)
            ),
            el(
                'div',
                { position: 'absolute', right: 60, bottom: 40, fontSize: 30, color: '#222' },
                `${environment.eventDateDisplay}, ${environment.year} · Minneapolis`
            ),
        ]
    );

    const svg = await satori(card as any, {
        width: WIDTH,
        height: HEIGHT,
        fonts: [
            { name: 'Montserrat', data: Buffer.from(montserrat400), weight: 400, style: 'normal' },
            { name: 'Montserrat', data: Buffer.from(montserrat700), weight: 700, style: 'normal' },
        ],
    });
    return new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();
}
