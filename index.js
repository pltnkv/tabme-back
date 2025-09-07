require('dotenv').config()
const Mixpanel = require('mixpanel')
const express = require('express')
const rateLimit = require('express-rate-limit')
// const cors = require('cors')
// const crypto = require('crypto')

const app = express()
const PORT = 4000
const MIXPANEL_TOKEN = process.env.MIXPANEL_TOKEN
const API_KEY = process.env.STATS_API_KEY

if (!MIXPANEL_TOKEN) {
    console.error('MIXPANEL_TOKEN is not set')
    process.exit(1)
}

const mp = Mixpanel.init(MIXPANEL_TOKEN)

// --- middleware
app.use(express.json({limit: '200kb'}))
// app.use(cors({
//     origin: [
//         'http://localhost:5173',
//         'http://localhost:4000',
//         'https://staging.gettabme.com',
//         'https://gettabme.com',
//         // при необходимости: 'chrome-extension://<your-extension-id>'
//     ],
//     methods: ['GET', 'POST'],
// }))

// ---------- allow CORS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key')
    res.setHeader('Access-Control-Max-Age', '86400') // cache preflight for a day
    if (req.method === 'OPTIONS') return res.status(204).end()
    next()
})
app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 120,
}))

// --- healthcheck и корень
app.get('/', (_req, res) => {
    res.type('text/plain').send('Tabme index')
})
app.get('/health', (_req, res) => res.json({ok: true}))

/**
 * POST /track-event
 * body: {
 *   event: string,
 *   properties: object,
 *   identify_id: string,
 * }
 */
app.post('/track-event', verifyApiKey, async (req, res) => {
    try {
        const {event, properties = {}, identify_id} = req.body || {}

        if (!event || typeof event !== 'string') {
            return res.status(400).json({ok: false, error: 'invalid event'})
        }
        if (!identify_id || typeof identify_id !== 'string') {
            return res.status(400).json({ok: false, error: 'invalid identify_id'})
        }
        if (properties && typeof properties !== 'object') {
            return res.status(400).json({ok: false, error: 'invalid properties'})
        }


        const payload = {
            ...properties,
            distinct_id: identify_id,
            $source: 'tabme-server',
            server_env: process.env.NODE_ENV || 'production',
            user_agent: req.get('user-agent') || undefined,
            ip: req.ip
        }

        mp.track(event, payload, (err) => {
            if (err) {
                console.error('mixpanel.track error:', err)
                return res.status(502).json({ok: false, error: 'mixpanel_failed'})
            }
            return res.json({ok: true})
        })
    } catch (e) {
        console.error(e)
        res.status(500).json({ok: false, error: 'server_error'})
    }
})

// ---- Только для /track-event
function verifyApiKey(req, res, next) {
    if (!API_KEY) return next() // защиты нет — пропускаем
    const key = req.header('x-api-key')
    if (key !== API_KEY) return res.status(401).json({ ok: false, error: 'unauthorized' })
    next()
}

app.listen(PORT, () => {
    console.log(`Server listening at http://localhost:${PORT}`)
})
