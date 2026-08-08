# Deploy Checklist

## Local final test

```bash
npm install
npm run build
npm start
```

Open:

```text
http://localhost:4000
```

Check:

- Login works
- Sales list loads
- Add sale works
- Excel export works
- PDF export works
- Backup JSON works

## Render

Environment variables:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=long-random-secret
PORT=4000
VITE_API_URL=
```

Build command:

```bash
npm install && npm run build
```

Start command:

```bash
npm start
```
