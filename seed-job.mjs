const ADMIN_KEY  = '3bec00ca0c3b71053899c9de96085aaba8124dba7fd1efa903b47e23be80a746';
const BACKEND    = 'https://company-website-backend-91ia.onrender.com';

const body = JSON.stringify({
  title:       "Digital Marketing Executive",
  team:        "Marketing",
  location:    "Mysore, India",
  type:        "Full-time",
  experience:  "1-3 Years",
  description: "We are looking for a driven Digital Marketing Executive to develop, implement, track and optimize digital marketing campaigns across all channels including SEO, social media, email, and PPC.",
  isActive:    true
});

fetch(`${BACKEND}/api/admin/jobs`, {
  method:  "POST",
  headers: {
    "Content-Type": "application/json",
    "x-admin-key":  ADMIN_KEY
  },
  body
})
  .then(async r => {
    const text = await r.text();
    console.log('Status:', r.status);
    console.log('Response:', text);
    try { console.log('Parsed:', JSON.stringify(JSON.parse(text), null, 2)); } catch {}
  })
  .catch(e => console.error("❌ Network Error:", e.message));
