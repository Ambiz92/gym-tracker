# Phone lost or stolen

The phone holds two things an attacker could use: a logged-in session (tokens in the browser's `localStorage`) and the authenticator app with the TOTP secret. The app's "Esci" button only signs out the device it runs on (`scope: 'local'`), so it cannot help from another device. Everything below is done from a laptop, in the Supabase dashboard, in this order.

Lock the phone and its accounts first (Find My / Find Hub, SIM block) if you can. Then:

## 1. End every session

Dashboard, SQL Editor:

```sql
delete from auth.sessions
where user_id = (select id from auth.users where email = '<your email>');
```

This removes the refresh tokens, so no device can renew its session. An access token that was already issued stays valid until it expires, at most one hour (`jwt_expiry = 3600`). If the dashboard's Authentication, Users page has a "Sign out" action for the user, it does the same.

## 2. Change the password

Choose a long generated password from your password manager, one that has never been used elsewhere. In the SQL Editor:

```sql
update auth.users
set encrypted_password = crypt('<new password>', gen_salt('bf'))
where email = '<your email>';
```

The editor keeps a query history, so delete the query from the history afterwards. Then run step 1 again, in case a session was opened between the two steps.

## 3. Remove the old TOTP factor

The lost authenticator holds the secret, so the factor has to go. Dashboard, Authentication, Users, your user, "Remove MFA factors".

Until a new factor is verified, the password alone is enough to enroll one (S1-12), so do step 4 right away and do not leave the account in this state.

## 4. Enroll a new TOTP factor

On the laptop, open the app, sign in with the new password and scan the QR code with the authenticator on the new phone. Confirm the six-digit code.

Check in the dashboard, Authentication, Users, that the user has exactly one verified factor and no unverified ones.

## 5. Check the rest

- `select count(*) from auth.sessions where user_id = '<user id>'` shows only your new session.
- The password manager, the email account and the GitHub account were possibly reachable from the phone: change their passwords and review their active sessions and 2FA devices too.
- If the phone held the Supabase dashboard login or a database password, rotate those as well.
- Sign in on the new phone with the new password and TOTP.

## Why there is no button in the app

A "sign out everywhere" button (`signOut({ scope: 'global' })`) would work from the laptop, but it is outside the feature list and needs a decision first. Until then this procedure is the answer for S1-05.
