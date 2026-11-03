const express = require('express');
const path = require('node:path');
const { google } = require('googleapis');

const sheetId = process.env.GOOGLE_SHEET_ID || "1fIKI64zP99ZN4IOhlAogu2Qv2Hx-meAgITaOeLNH0GU";
const app = express();

let credentials;
if (process.env.GOOGLE_CREDENTIALS) {
	credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
} else {
	credentials = require('./credentials.json');
}

const auth = new google.auth.JWT({
	email: credentials.client_email,
	key: credentials.private_key,
	scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

app.use((req, res, next) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
	if (req.method === 'OPTIONS') return res.sendStatus(204);
	next();
});
app.use(express.json({ limit: '10kb' }));

// الصفحة الرئيسية
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/preorders', async (req, res) => {
	const order = req.body;
	const fields = ['name', 'phone', 'job', 'color', 'qty', 'at'];
	if (!order || fields.some((f) => typeof order[f] !== 'string' || !order[f].trim())) {
		return res.status(400).json({ error: 'Missing required order data' });
	}

	try {
		await sheets.spreadsheets.values.append({
			spreadsheetId: sheetId,
			range: 'A:F',
			valueInputOption: 'RAW',
			insertDataOption: 'INSERT_ROWS',
			requestBody: {
				values: [[order.name, order.phone, order.job, order.color, order.qty, order.at]],
			},
		});
		res.json({ ok: true });
	} catch (error) {
		console.error('Could not save preorder:', error.message);
		res.status(500).json({ error: 'Could not save preorder' });
	}
});

// للتجربة على جهازك: node server.js
if (require.main === module) {
	const port = Number(process.env.PORT || 3000);
	app.listen(port, () => console.log(`Listening on port ${port}`));
}

module.exports = app;
