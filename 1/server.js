require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
// 50MB limit zbog base64 slika učenika i nastavnika
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || '';

if (!MONGO_URI) {
  console.warn('⚠️  MONGO_URI nije postavljen u Environment Variables.');
}

mongoose.connect(MONGO_URI || 'mongodb://127.0.0.1:27017/esdnevnik', {
  serverSelectionTimeoutMS: 10000
})
  .then(() => console.log('✅ Uspešno povezan sa MongoDB bazom!'))
  .catch(err => console.error('❌ KRITIČNO: Konekcija sa bazom nije uspela:', err.message));

// =========================================================
// ŠEME PODATAKA – strict:false garantuje čuvanje svih polja
// =========================================================

const Grupa = mongoose.model('Grupa', new mongoose.Schema({
  id: String,
  naziv: { type: String, required: true },
  izvornoOdeljenje: { type: String, required: true },
  uceniciIds: [{ type: String }]
}, { timestamps: true, strict: false }));

const Predmet = mongoose.model('Predmet', new mongoose.Schema({
  id: String,
  naziv: String
}, { timestamps: true, strict: false }));

const Odeljenje = mongoose.model('Odeljenje', new mongoose.Schema({
  naziv: String
}, { timestamps: true, strict: false }));

const Pismeni = mongoose.model('Pismeni', new mongoose.Schema({
  id: String,
  odeljenje: String,
  predmet: String,
  datum: String,
  vrsta: String,
  sadrzaj: String
}, { timestamps: true, strict: false }));

const Skola = mongoose.model('Skola', new mongoose.Schema({
  naziv: String
}, { timestamps: true, strict: false }));

const SkolskaGodina = mongoose.model('SkolskaGodina', new mongoose.Schema({
  godina: String,
  naziv: String
}, { timestamps: true, strict: false }));

const NastavnikSchema = new mongoose.Schema({
  ime: String,
  uloga: String,
  username: String,
  password: { type: String, default: 'admin123', select: false },
  odeljenja: [String],
  predmeti: [String],
  profilna: String
}, { timestamps: true, strict: false });

NastavnikSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    if (typeof this.password === 'string' && this.password.startsWith('$2')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});
const Nastavnik = mongoose.model('Nastavnik', NastavnikSchema);

const Cas = mongoose.model('Cas', new mongoose.Schema({
  id: mongoose.Schema.Types.Mixed,
  lekcija: String,
  rbr: mongoose.Schema.Types.Mixed,
  tip: String,
  type: String,
  belezka: String,
  beleska: String,
  odeljenje: String,
  predmetId: String,
  predmet: String,
  datum: String,
  redari: [String]
}, { timestamps: true, strict: false }));

// Podšeme sa strict:false da Mongoose nikada ne izbaci dodatna polja
//
// NAPOMENA – Формативно оцењивање (тужић / равнић / смајлић):
// Formativne ocene se čuvaju kao stavke u Ucenik.ocene nizu, sa:
//   tip: 'Формативна', simbol: 'tuzno' | 'ravno' | 'nasmejano', vrednost: naziv (label),
//   beleska, predmet, datum, jeZakljucna: false, ulaziUProsek: false
// Pošto je OcenaSubSchema strict:false, ova polja se automatski čuvaju i vraćaju
// preko postojećih ruta (PUT/POST /api/ucenici/:id), bez potrebe za posebnim rutama –
// frontend uvek šalje ceo ažurirani niz "ocene" koji azurirajDokument() snima sa $set.
const OcenaSubSchema = new mongoose.Schema({
  id: mongoose.Schema.Types.Mixed,
  tip: String,
  vrednost: mongoose.Schema.Types.Mixed,
  vrsta: String,
  beleska: String,
  predmet: String,
  datum: String,
  jeZakljucna: Boolean,
  ulaziUProsek: Boolean,
  period: String,
  simbol: String,
  tipAktivnosti: String,
  prikazNaziv: String
}, { _id: false, strict: false });

const IzostanakSubSchema = new mongoose.Schema({
  lekcija: String,
  predmet: String,
  datum: String,
  rbr: mongoose.Schema.Types.Mixed,
  status: { type: String, default: 'нерегулисано' },
  beleska: String
}, { _id: false, strict: false });

const VladanjeSubSchema = new mongoose.Schema({
  id: mongoose.Schema.Types.Mixed,
  tip_zapisa: String,
  vrsta: String,
  tekst: String,
  datum: String,
  predmet: String,
  cas: mongoose.Schema.Types.Mixed,
  posledica: String
}, { _id: false, strict: false });

const VladanjeOcenaSubSchema = new mongoose.Schema({
  id: mongoose.Schema.Types.Mixed,
  broj: Number,
  vrednost: String,
  period: String,
  datum: String,
  beleska: String,
  jeZakljucna: Boolean
}, { _id: false, strict: false });

const Ucenik = mongoose.model('Ucenik', new mongoose.Schema({
  id: String,
  ime: String,
  prezime: String,
  odeljenje: String,
  pol: String,
  profilna: String,
  ocena_vladanja: { type: String, default: '5' },
  ocena_vladanja_broj: Number,
  vladanje_ocene: [VladanjeOcenaSubSchema],
  vladanje_zakljucne: [VladanjeOcenaSubSchema],
  ocene: [OcenaSubSchema],
  izostanci: [IzostanakSubSchema],
  vladanje_lista: [VladanjeSubSchema],
  aktivnosti: [mongoose.Schema.Types.Mixed]
}, { timestamps: true, strict: false }));

const BrisanjeZakljucne = mongoose.model('BrisanjeZakljucne', new mongoose.Schema({
  id: mongoose.Schema.Types.Mixed,
  ucenikId: String,
  ucenikIme: String,
  odeljenje: String,
  ocena: String,
  period: String,
  predmet: String,
  razlog: { type: String, required: true },
  datumVreme: String,
  obrisaoUsername: String
}, { timestamps: true, strict: false }));

const Ocena = mongoose.model('Ocena', new mongoose.Schema({
  ucenikId: String,
  predmet: String,
  vrednost: String,
  jeZakljucna: Boolean,
  period: String,
  ulaziUProsek: Boolean,
  napomena: String,
  beleska: String,
  datum: { type: Date, default: Date.now }
}, { strict: false }));

// Pomoćne funkcije za ažuriranje i brisanje bez CastError-a
function bodyBezMeta(body) {
  const b = { ...(body || {}) };
  delete b._id;
  delete b.__v;
  return b;
}

async function azurirajDokument(Model, id, body) {
  const data = bodyBezMeta(body);
  let doc = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    doc = await Model.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: false, strict: false }
    );
  }
  if (!doc) {
    doc = await Model.findOneAndUpdate(
      { id: String(id) },
      { $set: data },
      { new: true, runValidators: false, strict: false }
    );
  }
  return doc;
}

async function obrisiDokument(Model, id, altQuery = {}) {
  let doc = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    doc = await Model.findByIdAndDelete(id);
  }
  if (!doc) {
    doc = await Model.findOneAndDelete({ id: String(id), ...altQuery });
  }
  return doc;
}

// =========================================================
// RUTE
// =========================================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/login', (req, res) => res.redirect('/'));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.get('/api/napravi-admina', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Baza nije povezana.' });
    }
    const provera = await Nastavnik.findOne({ username: 'admin' });
    if (provera) return res.json({ poruka: "Korisnik 'admin' već postoji!" });
    const noviAdmin = new Nastavnik({
      ime: 'Стефан Михајловић',
      uloga: 'Администратор',
      username: 'admin',
      password: 'admin123',
      odeljenja: [],
      predmeti: []
    });
    await noviAdmin.save();
    res.json({ success: true, poruka: 'Korisnik kreiran!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Sva polja su obavezna' });
    }
    const nastavnik = await Nastavnik.findOne({ username: username.trim() }).select('+password');
    if (!nastavnik) {
      return res.status(401).json({ success: false, message: 'Pogrešni podaci' });
    }
    if (nastavnik.password === password.trim()) {
      const o = nastavnik.toObject();
      delete o.password;
      return res.json({ success: true, user: o });
    }
    const isMatch = await bcrypt.compare(password.trim(), nastavnik.password);
    if (isMatch) {
      const o = nastavnik.toObject();
      delete o.password;
      return res.json({ success: true, user: o });
    }
    res.status(401).json({ success: false, message: 'Pogrešni podaci' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kompletan snapshot podataka za index.html
app.get('/api/podaci', async (req, res) => {
  try {
    const [ucenici, casovi, predmeti, odeljenja, siroviNastavnici, grupe, brisanja, pismeni, skole, godine] = await Promise.all([
      Ucenik.find().lean(),
      Cas.find().lean(),
      Predmet.find().lean(),
      Odeljenje.find().lean(),
      Nastavnik.find().lean(),
      Grupa.find().lean(),
      BrisanjeZakljucne.find().sort({ createdAt: -1 }).lean(),
      Pismeni.find().lean(),
      Skola.find().lean(),
      SkolskaGodina.find().lean()
    ]);
    const nastavnici = siroviNastavnici.map(n => {
      const o = { ...n };
      delete o.password;
      return o;
    });
    res.json({ ucenici, casovi, nastavnici, predmeti, odeljenja, grupe, brisanja, pismeni, skole, godine });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ČASOVI ---
app.get('/api/casovi', async (req, res) => {
  try {
    res.json(await Cas.find().lean());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/casovi', async (req, res) => {
  try {
    const sacuvanCas = await new Cas(req.body).save();
    res.status(201).json({ success: true, podaci: sacuvanCas });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/casovi/:id', async (req, res) => {
  try {
    const az = await azurirajDokument(Cas, req.params.id, req.body);
    if (!az) return res.status(404).json({ success: false, error: 'Čas nije pronađen' });
    res.json({ success: true, podaci: az });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/casovi/:id', async (req, res) => {
  try {
    const obrisan = await obrisiDokument(Cas, req.params.id);
    if (!obrisan) return res.status(404).json({ success: false, error: 'Čas nije pronađen' });
    res.json({ success: true, poruka: 'Čas uspešno obrisan', id: req.params.id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- UČENICI ---
app.get('/api/ucenici', async (req, res) => {
  try {
    res.json(await Ucenik.find().lean());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ucenici', async (req, res) => {
  try {
    const sacuvan = await new Ucenik(req.body).save();
    res.status(201).json(sacuvan);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/ucenici/:id', async (req, res) => {
  try {
    const az = await azurirajDokument(Ucenik, req.params.id, req.body);
    if (!az) return res.status(404).json({ error: 'Učenik nije pronađen' });
    res.json(az);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/ucenici/:id', async (req, res) => {
  try {
    const obrisan = await obrisiDokument(Ucenik, req.params.id);
    if (!obrisan) return res.status(404).json({ error: 'Učenik nije pronađen' });
    await Roditelj.deleteMany({ ucenikId: String(obrisan._id) });
    res.json({ success: true, poruka: 'Učenik uspešno obrisan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- NASTAVNICI ---
app.get('/api/nastavnici', async (req, res) => {
  try {
    const lista = await Nastavnik.find().lean();
    res.json(lista.map(n => {
      const o = { ...n };
      delete o.password;
      return o;
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/nastavnici', async (req, res) => {
  try {
    const sacuvan = await new Nastavnik(req.body).save();
    const o = sacuvan.toObject();
    delete o.password;
    res.status(201).json({ success: true, podaci: o });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/nastavnici/:id', async (req, res) => {
  try {
    const body = bodyBezMeta(req.body);
    delete body.password;
    const az = await azurirajDokument(Nastavnik, req.params.id, body);
    if (!az) return res.status(404).json({ error: 'Nastavnik nije pronađen' });
    const o = az.toObject ? az.toObject() : az;
    delete o.password;
    res.json({ success: true, podaci: o });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/nastavnici/:id', async (req, res) => {
  try {
    const obrisan = await obrisiDokument(Nastavnik, req.params.id);
    if (!obrisan) return res.status(404).json({ error: 'Nastavnik nije pronađen' });
    res.json({ success: true, poruka: 'Nastavnik obrisan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/nastavnici/profilna', async (req, res) => {
  try {
    const { username, profilna } = req.body;
    if (!username) return res.status(400).json({ error: 'username obavezan' });
    const n = await Nastavnik.findOneAndUpdate(
      { username },
      { $set: { profilna: profilna || null } },
      { new: true, strict: false }
    );
    if (!n) return res.status(404).json({ error: 'Nastavnik nije pronađen' });
    res.json({ success: true, profilna: n.profilna });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/nastavnici/promena-lozinke', async (req, res) => {
  try {
    const { username, novaLozinka } = req.body;
    let korisnik = await Nastavnik.findOne({ username });
    if (!korisnik && username === 'admin') {
      korisnik = new Nastavnik({
        ime: 'Стефан Михајловић',
        uloga: 'Администратор',
        username: 'admin'
      });
    }
    if (korisnik) {
      korisnik.password = novaLozinka;
      await korisnik.save();
      return res.json({ success: true, message: 'Lozinka promenjena!' });
    }
    res.status(404).json({ success: false, message: 'Korisnik nije pronađen' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- PISM странica: PISMENI RADOVI ---
app.get('/api/pismeni', async (req, res) => {
  try {
    const lista = await Pismeni.find().lean();
    res.json(lista);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pismeni', async (req, res) => {
  try {
    const novRad = await new Pismeni(req.body).save();
    res.status(201).json({ success: true, podaci: novRad });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/pismeni/:id', async (req, res) => {
  try {
    const obrisan = await obrisiDokument(Pismeni, req.params.id);
    if (!obrisan) return res.status(404).json({ success: false, error: 'Pismeni rad nije pronađen' });
    res.json({ success: true, poruka: 'Pismeni rad uspešno obrisan' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- ODELJENJA ---
app.get('/api/odeljenja', async (req, res) => {
  try {
    res.json(await Odeljenje.find().lean());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/odeljenja', async (req, res) => {
  try {
    const sacuvan = await new Odeljenje(req.body).save();
    res.status(201).json(sacuvan);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/odeljenja/:id', async (req, res) => {
  try {
    let obrisan = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      obrisan = await Odeljenje.findByIdAndDelete(req.params.id);
    }
    if (!obrisan) {
      obrisan = await Odeljenje.findOneAndDelete({ naziv: req.params.id });
    }
    if (!obrisan) {
      obrisan = await Odeljenje.findOneAndDelete({ id: req.params.id });
    }
    res.json({ success: true, poruka: 'Odeljenje obrisano' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PREDMETI ---
app.get('/api/predmeti', async (req, res) => {
  try {
    res.json(await Predmet.find().lean());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/predmeti', async (req, res) => {
  try {
    const nov = await Predmet.create(req.body);
    res.status(200).json(nov);
  } catch (err) {
    res.status(400).json(err);
  }
});

app.delete('/api/predmeti/:id', async (req, res) => {
  try {
    let obrisan = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      obrisan = await Predmet.findByIdAndDelete(req.params.id);
    }
    if (!obrisan) {
      obrisan = await Predmet.findOneAndDelete({ id: req.params.id });
    }
    if (!obrisan) {
      obrisan = await Predmet.findOneAndDelete({ naziv: req.params.id });
    }
    res.json({ success: true, poruka: 'Predmet obrisan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GRUPE ---
app.get('/api/grupe', async (req, res) => {
  try {
    res.json(await Grupa.find().lean());
  } catch (err) {
    res.status(500).json({ poruka: err.message });
  }
});

app.post('/api/grupe', async (req, res) => {
  try {
    const sacuvana = await new Grupa(req.body).save();
    res.status(201).json(sacuvana);
  } catch (err) {
    res.status(400).json({ poruka: err.message });
  }
});

app.put('/api/grupe/:id', async (req, res) => {
  try {
    const az = await azurirajDokument(Grupa, req.params.id, req.body);
    if (!az) return res.status(404).json({ poruka: 'Grupa nije pronađena' });
    res.json(az);
  } catch (err) {
    res.status(400).json({ poruka: err.message });
  }
});

app.delete('/api/grupe/:id', async (req, res) => {
  try {
    const obrisana = await obrisiDokument(Grupa, req.params.id);
    if (!obrisana) return res.status(404).json({ poruka: 'Grupa nije pronađena' });
    res.json({ poruka: 'Grupa uspešno obrisana' });
  } catch (err) {
    res.status(500).json({ poruka: err.message });
  }
});

// --- ŠKOLE I GODINE ---
app.get('/api/skole', async (req, res) => {
  try {
    res.json(await Skola.find().lean());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/skole', async (req, res) => {
  try {
    const s = await new Skola(req.body).save();
    res.status(201).json(s);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/skole/:id', async (req, res) => {
  try {
    await obrisiDokument(Skola, req.params.id, { naziv: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/godine', async (req, res) => {
  try {
    res.json(await SkolskaGodina.find().lean());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/godine', async (req, res) => {
  try {
    const g = await new SkolskaGodina(req.body).save();
    res.status(201).json(g);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/godine/:id', async (req, res) => {
  try {
    await obrisiDokument(SkolskaGodina, req.params.id, { godina: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- BRISANJA ZAKLJUČNIH OCENA ---
app.get('/api/brisanja-zakljucnih', async (req, res) => {
  try {
    const lista = await BrisanjeZakljucne.find().sort({ createdAt: -1 }).lean();
    res.json(lista);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/brisanja-zakljucnih', async (req, res) => {
  try {
    const zapis = await new BrisanjeZakljucne(req.body).save();
    res.status(201).json({ success: true, podaci: zapis });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/brisanja-zakljucnih/:id', async (req, res) => {
  try {
    await obrisiDokument(BrisanjeZakljucne, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stari endpoint za ocenu
app.post('/api/sacuvaj', async (req, res) => {
  try {
    const { ucenikId, predmet, vrednost, jeZakljucna, period, ulaziUProsek, napomena } = req.body;
    await new Ocena({
      ucenikId, predmet, vrednost, jeZakljucna, period, ulaziUProsek, napomena
    }).save();
    res.status(201).json({ poruka: 'Ocena uspešno sačuvana' });
  } catch (error) {
    res.status(500).json({ poruka: 'Greška pri čuvanju', error });
  }
});

// =========================================================
// RODITELJI (max 2 po učeniku) + PORTAL ZA RODITELJE
// =========================================================
const crypto = require('crypto');

const Roditelj = mongoose.model('Roditelj', new mongoose.Schema({
  ucenikId: { type: String, required: true, index: true },
  ime: { type: String, required: true },
  prezime: { type: String, required: true },
  mesto: String,
  username: { type: String, required: true, unique: true },
  password: { type: String, select: false },
  aktivan: { type: Boolean, default: true }
}, { timestamps: true }));

const TOKEN_SECRET = process.env.PARENT_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
const potpis = p => crypto.createHmac('sha256', TOKEN_SECRET).update(p).digest('base64url');

function napraviToken(id) {
  const p = Buffer.from(JSON.stringify({ rid: String(id), exp: Date.now() + 12 * 3600 * 1000 })).toString('base64url');
  return p + '.' + potpis(p);
}
function proveriToken(tok) {
  if (!tok || tok.split('.').length !== 2) return null;
  const [p, s] = tok.split('.');
  const a = Buffer.from(s), b = Buffer.from(potpis(p));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const d = JSON.parse(Buffer.from(p, 'base64url').toString());
    return d.exp > Date.now() ? d : null;
  } catch { return null; }
}

// zaštita od pogađanja lozinke: 5 grešaka = pauza 15 min
const pokusaji = new Map();
function jeBlokiran(k) {
  const p = pokusaji.get(k);
  if (!p) return false;
  if (p.until && Date.now() >= p.until) { pokusaji.delete(k); return false; }
  return p.n >= 5;
}
function zabeleziGresku(k) {
  const p = pokusaji.get(k) || { n: 0 };
  p.n++;
  if (p.n >= 5) p.until = Date.now() + 15 * 60 * 1000;
  pokusaji.set(k, p);
}

const pick = (o, keys) => { const r = {}; keys.forEach(k => { if (o && o[k] !== undefined) r[k] = o[k]; }); return r; };
const validanId = id => mongoose.Types.ObjectId.isValid(id);
function privremenaLozinka() {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(8)).map(x => a[x % a.length]).join('');
}

// ---------- Nastavnik: upravljanje roditeljima ----------
app.get('/api/roditelji/:ucenikId', async (req, res) => {
  try {
    res.json(await Roditelj.find({ ucenikId: req.params.ucenikId }).sort({ createdAt: 1 }).lean());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/roditelji', async (req, res) => {
  try {
    const { ucenikId, ime, prezime, mesto, username, password } = req.body || {};
    if (!ucenikId || !ime?.trim() || !prezime?.trim() || !mesto?.trim() || !username?.trim() || !password)
      return res.status(400).json({ error: 'Popunite sva polja.' });
    if (password.length < 6) return res.status(400).json({ error: 'Lozinka mora imati najmanje 6 karaktera.' });
    if (await Roditelj.countDocuments({ ucenikId }) >= 2)
      return res.status(400).json({ error: 'Učenik već ima 2 roditelja.' });
    const un = username.trim().toLowerCase();
    if (await Roditelj.findOne({ username: un }))
      return res.status(409).json({ error: 'Korisničko ime je zauzeto.' });
    const r = await Roditelj.create({
      ucenikId, ime: ime.trim(), prezime: prezime.trim(), mesto: mesto.trim(),
      username: un, password: await bcrypt.hash(password, 10)
    });
    const o = r.toObject(); delete o.password;
    res.status(201).json({ success: true, podaci: o });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/roditelji/:id/aktivan', async (req, res) => {
  try {
    if (!validanId(req.params.id)) return res.status(400).json({ error: 'Neispravan ID.' });
    const r = await Roditelj.findByIdAndUpdate(req.params.id, { $set: { aktivan: !!req.body.aktivan } }, { new: true });
    if (!r) return res.status(404).json({ error: 'Roditelj nije pronađen.' });
    res.json({ success: true, aktivan: r.aktivan });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/roditelji/:id/reset-lozinke', async (req, res) => {
  try {
    if (!validanId(req.params.id)) return res.status(400).json({ error: 'Neispravan ID.' });
    const lozinka = privremenaLozinka();
    const r = await Roditelj.findByIdAndUpdate(req.params.id, { $set: { password: await bcrypt.hash(lozinka, 10) } });
    if (!r) return res.status(404).json({ error: 'Roditelj nije pronađen.' });
    res.json({ success: true, lozinka });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/roditelji/:id', async (req, res) => {
  try {
    if (!validanId(req.params.id)) return res.status(400).json({ error: 'Neispravan ID.' });
    const r = await Roditelj.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ error: 'Roditelj nije pronađen.' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- Portal za roditelje ----------
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/fonts', express.static(path.join(__dirname, 'public', 'fonts')));
app.use('/img', express.static(path.join(__dirname, 'public', 'img')));
app.get('/roditelj', (req, res) => res.sendFile(path.join(__dirname, 'public', 'roditelj', 'index.html')));

app.post('/api/roditelj/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Unesite korisničko ime i lozinku.' });
    const un = String(username).trim().toLowerCase();
    const kljuc = req.ip + '|' + un;
    if (jeBlokiran(kljuc)) return res.status(429).json({ error: 'Previše pokušaja. Pokušajte ponovo za 15 minuta.' });
    const r = await Roditelj.findOne({ username: un }).select('+password');
    if (!r || !(await bcrypt.compare(String(password), r.password || ''))) {
      zabeleziGresku(kljuc);
      return res.status(401).json({ error: 'Pogrešno korisničko ime ili lozinka.' });
    }
    if (!r.aktivan) return res.status(403).json({ error: 'Nalog je deaktiviran. Obratite se školi.' });
    pokusaji.delete(kljuc);
    res.json({ success: true, token: napraviToken(r._id) });
  } catch (err) { res.status(500).json({ error: 'Greška servera.' }); }
});

async function authRoditelj(req, res, next) {
  try {
    const d = proveriToken((req.headers.authorization || '').replace('Bearer ', ''));
    if (!d || !validanId(d.rid)) return res.status(401).json({ error: 'Sesija je istekla.' });
    const r = await Roditelj.findById(d.rid).lean();
    if (!r || !r.aktivan) return res.status(401).json({ error: 'Nalog nije aktivan.' });
    req.roditelj = r; // ucenik se uvek uzima iz naloga roditelja, nikad iz zahteva
    next();
  } catch (err) { res.status(500).json({ error: 'Greška servera.' }); }
}

app.get('/api/roditelj/podaci', authRoditelj, async (req, res) => {
  try {
    const r = req.roditelj;
    let u = validanId(r.ucenikId) ? await Ucenik.findById(r.ucenikId).lean() : null;
    if (!u) u = await Ucenik.findOne({ id: r.ucenikId }).lean();
    if (!u) return res.status(404).json({ error: 'Učenik nije pronađen.' });

    const [casovi, pismeni, predmeti] = await Promise.all([
      Cas.find({ odeljenje: u.odeljenje }).sort({ createdAt: -1 }).limit(500).lean(),
      Pismeni.find({ odeljenje: u.odeljenje }).sort({ createdAt: -1 }).lean(),
      Predmet.find().lean()
    ]);

    res.json({
      roditelj: pick(r, ['ime', 'prezime']),
      ucenik: pick(u, ['ime', 'prezime', 'odeljenje']),
      predmeti: predmeti.map(p => pick({ ...p, _id: String(p._id) }, ['_id', 'id', 'naziv'])),
      ocene: (u.ocene || []).map(o => pick(o, ['id', 'tip', 'vrednost', 'vrsta', 'beleska', 'predmet', 'datum', 'jeZakljucna', 'period', 'simbol', 'prikazNaziv'])),
      casovi: casovi.map(c => pick(c, ['id', 'lekcija', 'rbr', 'tip', 'vrstaCasa', 'predmetId', 'datum', 'nastavnik'])),
      pismeni: pismeni.map(p => pick(p, ['id', 'predmet', 'datum', 'vrsta', 'sadrzaj'])),
      vladanje: {
        ocena: u.ocena_vladanja_broj || u.ocena_vladanja || null,
        ocene: [
          ...(u.vladanje_ocene || []).map(x => ({ ...x, zakljucna: false })),
          ...(u.vladanje_zakljucne || []).map(x => ({ ...x, zakljucna: true }))
        ].map(x => pick(x, ['id', 'broj', 'vrednost', 'period', 'datum', 'beleska', 'zakljucna'])),
        zapisi: (u.vladanje_lista || []).map(x => pick(x, ['id', 'tip_zapisa', 'vrsta', 'tekst', 'datum', 'predmet', 'cas', 'posledica']))
      }
    });
  } catch (err) { res.status(500).json({ error: 'Greška servera.' }); }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server uspešno pokrenut na portu ${PORT}`);
});
