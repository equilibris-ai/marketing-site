/* Footer shared by every page: divider rule, copyright, contact address. */
export default function SiteFooter() {
  return (
    <>
      <div className="wrap">
        <div className="rule" />
      </div>

      <footer>
        <div className="wrap foot">
          <span>&copy; 2026 Equilibris, Inc.</span>
          <span>
            <a href="mailto:waitlist@equilibris.ai">waitlist@equilibris.ai</a>
          </span>
        </div>
      </footer>
    </>
  );
}
