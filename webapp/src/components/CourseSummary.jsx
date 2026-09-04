import './CourseSummary.css'

export default function CourseSummary({ id, items }) {
  return (
    <aside className="course-summary" aria-labelledby={id}>
      <h2 id={id}>En bref</h2>
      <dl className="course-summary__grid">
        {items.map(({ label, value }) => (
          <div className="course-summary__item" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
