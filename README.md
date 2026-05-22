# UnitOne Backend

Zero-dependency Node.js API that matches the current UnitOne frontend calls.

## Endpoints

- `POST /api/v1/auth/login`
- `GET /api/v1/activities`
- `POST /api/v1/activities`
- `GET /api/v1/messages`
- `GET /api/v1/moment/posts`
- `GET /health`

Responses use the envelope that `api/http.js` already unwraps:

```json
{
  "code": 0,
  "success": true,
  "message": "ok",
  "data": {}
}
```

## Run

```bash
cd unitone-backend
npm start
```

For development:

```bash
npm run dev
```

Run the smoke tests:

```bash
npm test
```

Then update the frontend `config/env.js`:

```js
apiBaseUrl: 'http://localhost:3000',
useMock: false,
```

## Notes

- Data is stored in memory and seeded from the frontend mock shape.
- Login accepts any non-empty username and password, matching the frontend demo flow.
- `POST /api/v1/activities` maps the create-activity form fields into the card fields used by the home and moment pages.
