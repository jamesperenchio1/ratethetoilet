export function StepDots({ total, done }: { total: number; done: number }) {
  return (
    <div className="stepper">
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < done ? "done" : ""} />
      ))}
    </div>
  );
}
