const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const makeCertificateNumber = () => `CME-${Date.now()}`;

const generateCertificate = async ({ userName, courseTitle, points, outputDir }) => {
  const certificateNumber = makeCertificateNumber();
  const fileName = `${certificateNumber}.pdf`;
  const outPath = path.join(outputDir, fileName);

  await fs.promises.mkdir(outputDir, { recursive: true });

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(outPath);

    doc.pipe(stream);
    doc.fontSize(24).text('CHUNG NHAN CME', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`So chung nhan: ${certificateNumber}`);
    doc.moveDown();
    doc.text(`Nhan vien: ${userName}`);
    doc.text(`Khoa hoc: ${courseTitle}`);
    doc.text(`Diem CME: ${points}`);
    doc.text(`Ngay cap: ${new Date().toLocaleDateString('vi-VN')}`);
    doc.end();

    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return { certificateNumber, fileName };
};

module.exports = { generateCertificate };
