import { authenticate } from '@/lib/auth'
const r = await authenticate({ email: 'admin@axiom.mx', password: 'axiom12345' })
console.log(JSON.stringify(r).slice(0, 300))
