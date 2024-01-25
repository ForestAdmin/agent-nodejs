const AdmZip = require('adm-zip');
const axios = require('axios');
const fs = require('fs');

const downloadUrl = 'https://github.com/ForestAdmin/cloud-customizer/archive/main.zip';
const savePath = './cloud-customizer-main.zip';

axios({
  url: downloadUrl,
  method: 'get',
  responseType: 'stream',
})
  .then(response => {
    const stream = fs.createWriteStream(savePath);
    response.data.pipe(stream);

    return new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  })
  .then(() => {
    console.log(`Bootstrap is starting...`);
    console.log(`Code is downloaded.`);
    const zip = new AdmZip(savePath);
    // extract everything
    zip.extractAllTo('.', false);
    // rename cloud-customizer-main to cloud-customizer
    fs.renameSync('./cloud-customizer-main', './cloud-customizer');
    console.log(`Code is extracted.`);
    // remove zip file
    fs.unlinkSync(savePath);
    console.log(`Bootstrap is done.`);
  })
  .catch(error => {
    console.error('Bootstrap fails:', error.message);
  });
