# Offsite breakout signup

A phone-friendly signup page for the offsite breakouts. Participants don't need to log in. Each session card shows the room, the seats left, and who has already signed up (name and company only, never email). Signups are saved to a Google Sheet you own. You send the calendar invites yourself from the guest list in the sheet.

Files:
- `Code.gs` is the server code (Apps Script).
- `index.html` is the page. You can open it directly in a browser to preview it with sample data.

## One-time setup (about 10 minutes)

1. Create a Google Sheet (go to sheets.new) and name it something like *Offsite breakout signups*.
2. In the sheet, open **Extensions → Apps Script**.
3. Replace the contents of `Code.gs` in the editor with this folder's `Code.gs`.
4. Click **+** next to Files, choose **HTML**, and name it `Index` (no extension). Paste in this folder's `index.html`.
5. Save. Choose `setup` in the function dropdown on the toolbar, click **Run**, and approve the permission prompt. This creates three tabs: **Settings**, **Sessions** and **Signups**. You can delete the default `Sheet1`.
6. Click **Deploy → New deployment**. Under the gear icon choose **Web app**, then set:
   - Execute as: **Me**
   - Who has access: **Anyone**

   Deploy and copy the URL that ends in `/exec`. That's the link you share. To make a QR code for slides, open the link in Chrome and use **Share → Create QR code**.
7. Test it on your phone in a private browser window to confirm it works without a login.

If **Anyone** is missing from the access dropdown, your Google Workspace admin only allows sharing inside the organization. Ask them to allow external access for this script.

## The link to share: GitHub Pages

Share **https://skylaryoung.github.io/offsite-breakout-signup/** (QR code: `breakout-signup-qr.png`), not the `/exec` link.

The Apps Script `/exec` page fails with "Sorry, unable to open the file at this time" for anyone whose browser is signed in to more than one Google account. The GitHub Pages copy of `index.html` avoids that: it saves and loads signups through the script's `doPost` API without sending any Google sign-in.

- `API_URL` near the top of the script in `index.html` must be the `/exec` URL of the **current** deployment. If you create a new deployment instead of a new version of the existing one, the URL changes and `API_URL` needs updating.
- To publish a change to the page, commit and push `index.html` to this repo. Pages updates within a minute or two.

## Day-to-day

Edit everything in the sheet. Changes show up on the page at the next refresh, with no redeploy needed.

| Tab | What to edit |
|---|---|
| Settings | Event name, subtitle (date and place), intro text, the company choices people pick from (comma-separated), and the **Signups open** checkbox |
| Sessions | Title, room, capacity (leave blank for no limit), and an optional description |
| Signups | Read-only in practice. Delete a row to remove someone. |

- **Keep the session IDs (`S1` to `S4`) the same** once people have signed up, because signups point to the ID. Titles and rooms can change at any time.
- If someone signs up again with the same email, they're moved to the new session. Cancelling releases their seat.
- The page refreshes the seat counts every 30 seconds.

## Sending the invites

The **Sessions** tab has a **Guest emails** column for each session, already comma-separated. When you're ready:

1. Uncheck **Signups open** in the Settings tab so the lists stop changing.
2. For each session, create the Calendar event with the room in **Location**, then paste that session's guest emails into **Add guests**.

If people sign up later, add only the new emails to the existing event.

## Changing the code later

After you edit `Code.gs` or `index.html` in Apps Script, go to **Deploy → Manage deployments**, edit the existing deployment (pencil icon), choose **Version: New version**, and deploy. The `/exec` URL stays the same.

## Notes

- Google may show a small gray banner at the top of the page saying it was made with Apps Script. You can't remove it.
- Anyone with the link can see attendee names and companies. Share the link only with participants.
- To change the colors, edit the `:root` variables at the top of `index.html`. `--accent` is the button and highlight color.
