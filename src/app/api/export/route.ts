import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(req: Request) {
    try {
        const { type, data } = await req.json();

        const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const privateKey = process.env.GOOGLE_PRIVATE_KEY;
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;

        if (!clientEmail || !privateKey || !spreadsheetId) {
            return NextResponse.json(
                { error: 'Google Service Account credentials not configured in environment variables.' },
                { status: 500 }
            );
        }

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // Format Data for the sheet
        // Example format for sales
        const rows = type === 'penjualan' ? data.map((item: any) => [
            item.created_at,
            item.receipt_number,
            item.payment_method,
            item.status,
            item.total
        ]) : [];

        // Header Row
        if (rows.length > 0 && type === 'penjualan') {
            rows.unshift(['Tanggal & Waktu', 'No. Struk', 'Metode Bayar', 'Status Sync', 'Total Belanja']);
        }

        // Since this is a simple append, we just append to Sheet1!A1
        if (rows.length > 0) {
            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: 'Sheet1!A1', // Adjust this if you have specific tabs 
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: rows
                },
            });
        }

        return NextResponse.json({ success: true, message: 'Data exported successfully.' });
    } catch (error: any) {
        console.error('Google Sheets API Error:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to export data' },
            { status: 500 }
        );
    }
}
