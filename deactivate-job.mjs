// Deactivates the Digital Marketing Executive job on the careers website
const ADMIN_KEY = '3bec00ca0c3b71053899c9de96085aaba8124dba7fd1efa903b47e23be80a746';
const BACKEND   = 'https://company-website-backend-91ia.onrender.com';
const JOB_ID    = 'cf9b27db-7c11-4f9e-9906-05587f6f01a8';

fetch(`${BACKEND}/api/admin/jobs/${JOB_ID}`, {
  method:  'DELETE',
  headers: { 'x-admin-key': ADMIN_KEY },
})
  .then(async r => {
    const text = await r.text();
    console.log('Status:', r.status);
    console.log('Response:', text);
  })
  .catch(e => console.error('Error:', e.message));
