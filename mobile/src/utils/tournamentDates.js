const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
  if (!DATE_PATTERN.test(value || '')) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

function addDaysToDateString(dateString, days) {
  const date = parseLocalDate(dateString) || new Date();
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

function localDateTimeIso(dateString, boundary) {
  const date = parseLocalDate(dateString);
  if (!date) {
    return null;
  }

  if (boundary === 'end') {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date.toISOString();
}

// Drives the date inputs in the wizard: types YYYYMMDD digits and inserts
// dashes automatically so users don't have to deal with them.
function formatDateInput(value) {
  const digits = value.replace(/[^0-9]/g, '').slice(0, 8);
  if (digits.length <= 4) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function getTournamentDateValidation(startsAt, endsAt) {
  const today = localDateString(new Date());
  const startDate = parseLocalDate(startsAt);
  const endDate = parseLocalDate(endsAt);

  if (!startDate) {
    return { valid: false, startError: 'creator.dateRequired', today };
  }
  if (!endDate) {
    return { valid: false, endError: 'creator.dateRequired', today };
  }
  if (startsAt < today) {
    return { valid: false, startError: 'creator.startDateInPast', today };
  }
  if (endsAt < startsAt) {
    return { valid: false, endError: 'creator.endDateBeforeStart', today };
  }

  return { valid: true, today };
}

export {
  addDaysToDateString,
  formatDateInput,
  getTournamentDateValidation,
  localDateString,
  localDateTimeIso,
  parseLocalDate
};
