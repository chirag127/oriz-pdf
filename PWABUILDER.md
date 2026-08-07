# PWABuilder packaging — oriz PDF

- Live URL: https://pdf.oriz.in
- Android package id: `in.oriz.pdf`
- Signing SHA-256: `0C:82:DB:11:57:7E:21:8D:62:1E:54:DF:3B:33:D1:29:6E:77:56:80:36:22:C1:99:36:DF:03:D3:6F:0D:30:36`

## Steps

PWABuilder.com -> enter URL `https://pdf.oriz.in` -> Package For Stores -> Android (use existing signing key, package `in.oriz.pdf`) / Windows / iOS.

Android TWA URL verification uses `/.well-known/assetlinks.json` (already served at https://pdf.oriz.in/.well-known/assetlinks.json). Keep the SHA-256 above in sync with the upload key.
