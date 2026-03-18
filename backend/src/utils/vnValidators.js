const CCCD_PROVINCE_CODES = new Set([
  '001', '002', '004', '006', '008', '010', '011', '012', '014', '015',
  '017', '019', '020', '022', '024', '025', '026', '027', '030', '031',
  '033', '034', '035', '036', '037', '038', '040', '042', '044', '045',
  '046', '048', '049', '051', '052', '054', '056', '058', '060', '062',
  '064', '066', '067', '068', '070', '072', '074', '075', '077', '079',
  '080', '082', '083', '084', '086', '087', '089', '091', '092', '093',
  '094', '095', '096',
]);

const VN_MOBILE_PREFIXES = new Set([
  '032', '033', '034', '035', '036', '037', '038', '039',
  '052', '056', '058', '059',
  '070', '076', '077', '078', '079',
  '081', '082', '083', '084', '085', '086', '087', '088', '089',
  '090', '091', '092', '093', '094', '095', '096', '097', '098', '099',
]);

const isValidVietnamCccd = (value) => {
  const normalized = String(value || '').trim();
  if (!/^\d{12}$/.test(normalized)) return false;

  const provinceCode = normalized.slice(0, 3);
  const genderCenturyDigit = Number(normalized[3]);
  if (!CCCD_PROVINCE_CODES.has(provinceCode)) return false;
  if (!Number.isInteger(genderCenturyDigit) || genderCenturyDigit < 0 || genderCenturyDigit > 5) return false;

  return true;
};

const isValidVietnamPhone = (value) => {
  const normalized = String(value || '').trim();
  if (!/^\d{10}$/.test(normalized)) return false;
  return VN_MOBILE_PREFIXES.has(normalized.slice(0, 3));
};

module.exports = {
  isValidVietnamCccd,
  isValidVietnamPhone,
};
