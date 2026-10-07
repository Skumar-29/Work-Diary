import { useEffect, useState } from "react";
import { useStore } from "../context";
import { correctTimerStart, switchTimer } from "../domain/diary";
import { civil, minutesLabel, today } from "../domain/time";
import { type RuleReport } from "../domain/rules";
import { type RestType } from "../domain/model";
import { Action, Empty, Field, Fold, Modal } from "../components/UI";
export function useReport(asOf: string, range = 14, live = false) {
  const { s } = useStore(),
    [report, setReport] = useState<RuleReport | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let done = false;
    const worker = new Worker(
      new URL("../domain/rules.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (e) => {
      if (!done) {
        setReport(e.data.report || null);
        setError(e.data.error || "");
      }
    };
    worker.onerror = () =>
      setError(
        "Hours summary could not be calculated. Your records are saved.",
      );
    worker.postMessage({
      id: 1,
      s,
      asOf,
      range,
      now: live ? Date.now() : undefined,
    });
    return () => {
      done = true;
      worker.terminate();
    };
  }, [s, asOf, range, live]);
  return { report, error };
}
export function Driving({ onDiary }: { onDiary: () => void }) {
  const { s, mutate } = useStore(),
    [now, setNow] = useState(Date.now()),
    [vehicle, setVehicle] = useState(
      s.timer?.vehicle ||
        s.registry.find((r) => r.type === "vehicle")?.name ||
        "",
    ),
    [restType, setRestType] = useState<RestType>("stationary"),
    [correct, setCorrect] = useState(false),
    [local, setLocal] = useState(""),
    [occurrence, setOccurrence] = useState("-1");
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const clock = civil(now, s.profile.zone),
    { report, error } = useReport(clock.date + "T" + clock.time, 14, true),
    timer = s.timer,
    elapsed = timer ? Math.max(0, Math.floor((now - timer.start) / 1000)) : 0;
  return (
    <>
      <section className={"card drive-card " + (timer?.kind || "")}>
        <div className="row">
          <span className="eyebrow">
            {timer
              ? timer.kind === "work"
                ? "WORKING"
                : "RESTING"
              : "READY TO RECORD"}
          </span>
          <span className="small">
            {s.profile.base} · {clock.time}
          </span>
        </div>
        <div className="timer" aria-label="Elapsed time">
          {String(Math.floor(elapsed / 3600)).padStart(2, "0")}:
          {String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}
          <small>:{String(elapsed % 60).padStart(2, "0")}</small>
        </div>
        <div className="drive-actions">
          <Action
            primary={timer?.kind === "work"}
            onClick={() =>
              mutate((w) => {
                if (!vehicle.trim())
                  throw Error("Enter the truck registration.");
                switchTimer(w, "work", vehicle);
              })
            }
          >
            {timer?.kind === "work" ? "Working" : "Start work"}
          </Action>
          <Action
            primary={timer?.kind === "rest"}
            onClick={() =>
              mutate((w) => switchTimer(w, "rest", vehicle, restType))
            }
          >
            {timer?.kind === "rest" ? "Resting" : "Start rest"}
          </Action>
          {timer && (
            <Action
              onClick={() => mutate((w) => switchTimer(w, null, vehicle))}
            >
              Finish
            </Action>
          )}
        </div>
        <div className="fields">
          <Field
            label="Truck registration"
            value={vehicle}
            list="vehicles"
            disabled={!!timer}
            onChange={setVehicle}
          />
          <Field
            label="Rest type"
            value={restType}
            options={[
              ["stationary", "Stationary"],
              ["sleeper-moving", "Approved moving sleeper"],
            ]}
            onChange={(v) => setRestType(v as RestType)}
          />
        </div>
        {timer && (
          <div className="row">
            <span className="small">
              Started {civil(timer.start, timer.zone).date} ·{" "}
              {civil(timer.start, timer.zone).time}
            </span>
            <Action
              onClick={() => {
                const c = civil(timer.start, timer.zone);
                setLocal(c.date + "T" + c.time);
                setCorrect(true);
              }}
            >
              Correct start
            </Action>
          </div>
        )}
      </section>
      <div className="row actions">
        <Action onClick={onDiary}>Open today’s diary</Action>
        <span className="small">
          {s.profile.scheme} · {s.profile.twoUp ? "Two-up" : "Solo"}
        </span>
      </div>
      <section className="card">
        <h2>Hours review</h2>
        {error ? (
          <p className="banner">{error}</p>
        ) : !report ? (
          <Empty>Calculating…</Empty>
        ) : (
          <>
            <div className="metrics">
              <div>
                <span>Today’s work</span>
                <strong>{minutesLabel(report.days.at(-1)?.work || 0)}</strong>
              </div>
              <div>
                <span>Today’s rest</span>
                <strong>{minutesLabel(report.days.at(-1)?.rest || 0)}</strong>
              </div>
            </div>
            {report.nextBreak !== null && (
              <p>
                Work-cap estimate remaining:{" "}
                <strong>{minutesLabel(report.nextBreak)}</strong>
              </p>
            )}
            <p className="small">
              Decision aid only. Keep your required written diary or approved
              EWD.
            </p>
            {report.issues.length > 0 && (
              <Fold title={`${report.issues.length} items need review`} open>
                {report.issues.map((x, i) => (
                  <p key={i} className="small">
                    {x}
                  </p>
                ))}
              </Fold>
            )}
            <div className="check-list">
              {report.checks
                .filter((c) => c.end >= clock.date)
                .map((c, i) => (
                  <div className="record-line" key={i}>
                    <strong>{c.label}</strong>
                    <span>
                      {minutesLabel(c.work)}
                      {c.limit !== null ? " / " + minutesLabel(c.limit) : ""}
                    </span>
                    <span
                      className={
                        "status " + (c.status === "Exceeded" ? "bad" : "")
                      }
                    >
                      {c.status}
                    </span>
                  </div>
                ))}
            </div>
            <Fold title="Last work, major rest & counting periods">
              <p>{report.lastWork}</p>
              <p>{report.majorRest}</p>
              {report.checks.map((c, i) => (
                <p key={i} className="small">
                  {c.label}: {c.start} → {c.end}. {c.reason}
                </p>
              ))}
              <a href={report.source} target="_blank" rel="noreferrer">
                NHVR counting-time guidance
              </a>
            </Fold>
          </>
        )}
      </section>
      {correct && (
        <Modal title="Correct timer start" onClose={() => setCorrect(false)}>
          <Field
            label="Start (driver base time)"
            type="datetime-local"
            value={local}
            onChange={setLocal}
          />
          <Field
            label="Repeated clock-change hour"
            value={occurrence}
            options={[
              ["-1", "Not applicable / choose if repeated"],
              ["0", "First occurrence"],
              ["1", "Second occurrence"],
            ]}
            onChange={setOccurrence}
          />
          <Action
            primary
            onClick={async () => {
              await mutate((w) =>
                correctTimerStart(w, local, Number(occurrence)),
              );
              setCorrect(false);
            }}
          >
            Save corrected start
          </Action>
        </Modal>
      )}
    </>
  );
}
