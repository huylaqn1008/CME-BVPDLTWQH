const deriveTimelineStatus = (course) => {
  const now = new Date();
  const startRaw = course.startDate ? new Date(course.startDate) : null;
  const endRaw = course.endDate ? new Date(course.endDate) : null;

  const start = startRaw
    ? new Date(startRaw.getFullYear(), startRaw.getMonth(), startRaw.getDate(), 0, 0, 0, 0)
    : null;
  const end = endRaw
    ? new Date(endRaw.getFullYear(), endRaw.getMonth(), endRaw.getDate(), 23, 59, 59, 999)
    : null;

  if (start && now < start) return 'UPCOMING';
  if (end && now > end) return 'ENDED';
  return 'OPEN';
};

const timelineStatusLabel = {
  OPEN: 'Đang mở',
  UPCOMING: 'Sắp mở',
  ENDED: 'Đã đóng',
};

module.exports = { deriveTimelineStatus, timelineStatusLabel };
