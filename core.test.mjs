import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  elapsedSeconds,
  elapsedText,
  findDataset,
  inputHint,
  resolveStudentSelection,
  studentsInSet
} from "./core.js";

const datasets = JSON.parse(await readFile(new URL("./data.json", import.meta.url), "utf8"));

test("exports all Swift datasets and assignments", () => {
  assert.equal(datasets.length, 8);
  assert.equal(new Set(datasets.flatMap((item) => item.activities.map((activity) => activity.id))).size, 11);
  for (const dataset of datasets) {
    assert.equal(dataset.activities.length, 3);
    assert.equal(dataset.timeSets.length, 5);
    assert.equal(dataset.assignments.length, 40);
    assert.deepEqual(dataset.timeSets.map((item) => item.id), ["A", "B", "C", "D", "E"]);
  }
});

test("resolves the same student data as the fixed catalog", () => {
  const selection = resolveStudentSelection(datasets, "3814", "1");
  assert.equal(selection.studentNumber, 1);
  assert.equal(selection.timeSet.id, "A");
  assert.deepEqual(selection.timeSet.times.map((time) => time.displayText), ["7:00 AM", "4:00 PM", "9:00 PM"]);
  assert.equal(resolveStudentSelection(datasets, "3814", "0"), null);
  assert.equal(resolveStudentSelection(datasets, "3814", "41"), null);
  assert.equal(resolveStudentSelection(datasets, "0000", "1"), null);
});

test("keeps student-facing validation wording", () => {
  assert.equal(inputHint(datasets, "3814", "41"), "出席番号は、１〜４０までの数字をいれましょう");
  assert.equal(inputHint(datasets, "381", ""), "ゲームのコードは4けたの数字です。");
  assert.match(inputHint(datasets, "0000", ""), /そのコードは使えません/);
});

test("derives timer values from dates and freezes at found time", () => {
  assert.equal(elapsedSeconds(1_000, null, 68_900), 67);
  assert.equal(elapsedText(1_000, null, 68_900), "01:07");
  assert.equal(elapsedText(1_000, 11_900, 99_000), "00:10");
});

test("builds teacher groups from fixed assignments", () => {
  const dataset = findDataset(datasets, "3814");
  const all = dataset.timeSets.flatMap((set) => studentsInSet(dataset, set.id)).sort((a, b) => a - b);
  assert.deepEqual(all, Array.from({ length: 40 }, (_, index) => index + 1));
  assert.ok(dataset.timeSets.every((set) => studentsInSet(dataset, set.id).length === 8));
});

test("web speech configuration excludes known novelty voices", async () => {
  const source = await readFile(new URL("./app.js", import.meta.url), "utf8");
  for (const name of ["Bad News", "Bells", "Cellos", "Whisper", "Zarvox"]) {
    assert.match(source, new RegExp(`\\b${name}\\b`));
  }
  assert.match(source, /utterance\.rate = 0\.95/);
  assert.match(source, /utterance\.pitch = 1\.05/);
  assert.match(source, /utterance\.voice = voice/);
});
