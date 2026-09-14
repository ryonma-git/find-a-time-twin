export function isAsciiDigits(value) {
  return value.length > 0 && /^[0-9]+$/.test(value);
}

export function findDataset(datasets, code) {
  return datasets.find((dataset) => dataset.code === code) ?? null;
}

export function resolveStudentSelection(datasets, code, studentText) {
  const dataset = findDataset(datasets, code);
  if (!dataset || code.length !== 4 || !isAsciiDigits(code)) return null;
  if (studentText.length < 1 || studentText.length > 2 || !isAsciiDigits(studentText)) return null;
  const studentNumber = Number(studentText);
  if (studentNumber < 1 || studentNumber > 40) return null;
  const setID = dataset.assignments[studentNumber - 1];
  const timeSet = dataset.timeSets.find((item) => item.id === setID);
  return timeSet ? { dataset, studentNumber, timeSet } : null;
}

export function inputHint(datasets, code, studentText) {
  if (studentText && (!isAsciiDigits(studentText) || studentText.length > 2 || Number(studentText) < 1 || Number(studentText) > 40)) {
    return "出席番号は、１〜４０までの数字をいれましょう";
  }
  if (code && code.length !== 4) return "ゲームのコードは4けたの数字です。";
  if (code.length === 4 && !findDataset(datasets, code)) return "そのコードは使えません。ゲームのコードをたしかめよう。";
  return "ゲームのコードと、自分の出席番号を入れよう。";
}

export function elapsedSeconds(startedAt, stoppedAt, now = Date.now()) {
  if (startedAt == null) return 0;
  return Math.max(0, Math.floor(((stoppedAt ?? now) - startedAt) / 1000));
}

export function elapsedText(startedAt, stoppedAt, now = Date.now()) {
  const seconds = elapsedSeconds(startedAt, stoppedAt, now);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function studentsInSet(dataset, setID) {
  return dataset.assignments.flatMap((assigned, index) => assigned === setID ? [index + 1] : []);
}
