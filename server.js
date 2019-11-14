'use strict';

var express = require('express');

var mongoose = require('mongoose');

var cors = require('cors');
require('dotenv').config();
var app = express();

const bodyParser = require('body-parser');
const dns = require('dns');
// Basic Configuration
var port = process.env.PORT || 3000;
/** this project needs a db !! **/

// console.log('process.env.MONGOLAB_URI :', process.env.MONGOLAB_URI);
mongoose
  .connect(process.env.MONGOLAB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log('Connected to MongoDB...');
  })
  .catch(err => {
    console.error('Could not connect to MongoDB...', err);
  });

const urlSchema = new mongoose.Schema({
  url: String,
  count: Number
});
const URL = mongoose.model('URL', urlSchema);
app.use(cors());

/** this project needs to parse POST bodies **/
// you should mount the body-parser here
// app.use(bodyParser.urlencoded());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

const getHostname = url => {
  const regEx = new RegExp(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i);
  const domain = regEx.exec(url);

  if (domain) {
    return domain[1];
  }
  return null;
};

const util = require('util');
const dnsLookupAsync = util.promisify(dns.lookup);

const getAddress = async url => {
  return await dnsLookupAsync(url, '');
};

const createURL = async body => {
  // 1. Get the full url and the domain name & check if the submitted url is valid format
  const hostname = getHostname(body.url);
  console.log('hostname :', hostname);
  if (!hostname) {
    // If hostname is null, return null
    return null;
  }

  // 2. Check if the submitted url name points to a valid site (promisified dns.lookup)
  const { address } = await getAddress(hostname);
  console.log('address :', await address);
  if (!address) {
    // If address is null, return null
    return null;
  }

  // 3. Get the latest entry to the db
  const latestEntry = await URL.findOne().sort({ _id: -1 });
  // console.log('await latestEntry :', await latestEntry);

  const newEntry = new URL({
    url: body.url,
    count: latestEntry ? latestEntry._doc.count + 1 : 0
  });

  try {
    return await newEntry.save();
  } catch (err) {
    console.log(err.message);
  }
  return null;
};

app.post('/api/shorturl/new', async (req, res, next) => {
  const tempUrl = await createURL(req.body);
  if (tempUrl) {
    res.send({ original_url: tempUrl.url, short_url: tempUrl.count });
    next();
  } else {
    res.send({ error: 'invalid URL' });
  }
});

app.get('/api/shorturl/:id', async (req, res, next) => {
  const id = req.params.id;

  await URL.findOne({ count: id }, (err, doc) => {
    // res.send({ url: doc._doc.url });
    res.status(301).redirect(doc._doc.url);
  });
});

app.listen(port, function() {
  console.log(`Node.js listening on port ${port}...`);
});
