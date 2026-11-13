const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');

const sheetId = process.env.GOOGLE_SHEET_ID || "1qOr49Sq_MMh0DwJ8gwQX5fJeA7pOpITyt4jTuV1LZS4";
const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
const app = express();

const transporter = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: process.env.NOTIFY_EMAIL || 'zuhr.startup@gmail.com',
		pass: process.env.EMAIL_PASS || 'vkwv spjc vtbw hpyo',
	},
});

let sheets = null;
try {
	let credentials;
	if (process.env.GOOGLE_CREDENTIALS) {
		credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
	} else if (fs.existsSync(path.join(__dirname, 'mainkey.json'))) {
		credentials = require('./mainkey.json');
	} else if (fs.existsSync(path.join(__dirname, 'credentials.json'))) {
		credentials = require('./credentials.json');
	}

	if (credentials && credentials.client_email && credentials.private_key) {
		const auth = new google.auth.JWT({
			email: credentials.client_email,
			key: credentials.private_key.replace(/\\n/g, '\n'),
			scopes: ['https://www.googleapis.com/auth/spreadsheets'],
		});
		sheets = google.sheets({ version: 'v4', auth });
	}
} catch (e) {
	console.error('Credentials error:', e.message);
}

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

app.post(['/api/preorders', '/preorders'], async (req, res) => {
	const order = req.body;
	const fields = ['name', 'phone', 'job', 'color', 'qty', 'at'];
	if (!order || fields.some((f) => typeof order[f] !== 'string' || !order[f].trim())) {
		return res.status(400).json({ error: 'Missing required order data' });
	}

	// حفظ في جوجل شيت لو متاح
	if (sheets) {
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
		} catch (err) {
			console.error('Google Sheets append error:', err.message);
		}
	} else if (scriptUrl) {
		try {
			await fetch(scriptUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(order),
			});
		} catch (err) {
			console.error('Apps Script error:', err.message);
		}
	}

	// إرسال إشعار فوري على الإيميل
	try {
		await transporter.sendMail({
			from: '"ZUHR System" <zuhr.startup@gmail.com>',
			to: process.env.NOTIFY_EMAIL || 'zuhr.startup@gmail.com',
			subject: `طلب حجز جديد: ${order.name}`,
			text: `تم استلام طلب حجز جديد:\n\nالاسم: ${order.name}\nالموبايل: ${order.phone}\nالوظيفة: ${order.job}\nاللون: ${order.color}\nالكمية: ${order.qty}\nالتاريخ: ${order.at}`,
		});
	} catch (mailErr) {
		console.error('Email notification error:', mailErr.message);
	}

	res.json({ ok: true });
});

// للتجربة على جهازك: node server.js
if (require.main === module) {
	const port = Number(process.env.PORT || 3000);
	app.listen(port, () => console.log(`Listening on port ${port}`));
}

module.exports = app;
