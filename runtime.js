import plural_ru from './plural_ru.js';

const strings = {};

export function setStrings(lang, strHash)
{
    strings[lang] = strHash;
}

export function addStrings(lang, strHash)
{
    Object.assign(strings[lang], strHash);
}

let fallback = 'en', language = 'ru';

export function setLanguage(lang)
{
    language = lang;
}

export function setFallback(lang)
{
    fallback = lang;
}

export function L(s)
{
    s = strings[language] && strings[language][s] || strings[fallback] && strings[fallback][s] || s;
    if (arguments.length > 1)
    {
        const arg = arguments;
        s = s.replace(/\{(\d+)\}/g, (m, m1) => (arg[parseInt(m1)]||''));
        s = s.replace(
            /\{N:(\d+):((?:[^:\\]+|\\.)*):((?:[^:\\]+|\\.)*):((?:[^:\\]+|\\.)*)\}/g,
            (m, m1, m2, m3, m4) => plural_ru(
                arg[parseInt(m1)]||'',
                m2.replace(/\\(.)/g, '$1'),
                m3.replace(/\\(.)/g, '$1'),
                m4.replace(/\\(.)/g, '$1')
            )
        );
    }
    return s;
}