# Design QA

- Visual references: selected HOME mock and the supplied membership CTA reference.
- Implementation URL: `http://127.0.0.1:8080/#inicio`.
- Viewports: 390 x 844 and 360 x 760.
- State: signed out, HOME selected, CTA visible.
- Combined comparison: `design-screenshots/home-comparison.png`.

**Findings and corrections**

- Removed an invisible horizontal overflow caused by full-bleed negative margins.
- Kept the event title and news title on the same content-title type scale.
- Kept `PROXIMO EVENTO` and `ULTIMAS NOTICIAS` on the same section-label scale.
- Adapted the supplied outlined CTA to the mobile width without changing its message or icon treatment.
- Confirmed that the bottom navigation does not cover the CTA at either viewport.

**Interaction checks**

- The latest-news preview opens the internal article route.
- The article back control returns to HOME.
- The original Diario SUR link remains available from the article footer.
- The signed-out CTA opens the registration tab in the personal area.
- The CTA is conditionally omitted for authenticated identities in the component logic.

**Verification**

- TypeScript and production Webpack build: passed.
- Whitespace validation with `git diff --check`: passed.
- Mobile visual comparison: passed.
- Horizontal overflow checks at 390 x 844 and 360 x 760: passed.
- Browser console error check: passed.

final result: passed
