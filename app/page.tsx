import Image from 'next/image'
import WaitlistForm from '@/components/WaitlistForm'
import VantaHalo from '@/components/VantaHalo'

export default function Home () {
  return (
    <>
      <VantaHalo />
      <div className='vanta-veil' aria-hidden='true' />

      <div className='page'>
        {/* ---------- Top bar ---------- */}
        <header className='topbar'>
          <div className='brand'>
            <Image
              src='/assets/images/logos/equilibris-logo-symbol.png'
              alt='Equilibris'
              width={80}
              height={80}
              priority
            />
            <span className='brand-name'>Equilibris</span>
          </div>
          <span className='nav-pill'>Private Beta · 2026</span>
        </header>

        {/* ---------- Hero ---------- */}
        <section className='hero'>
          <span className='eyebrow'>AI-Powered Financial Intelligence</span>
          <h1>
            Your taxes,
            <br />
            <span className='accent'>at your fingertips.</span>
          </h1>
          <p className='lede'>
            Built for people whose returns aren&apos;t simple — business owners,
            landlords, multi-state filers, and everyone with a little
            complication. Equilibris finds the strategy; you keep the upside.
          </p>
          <p className='sub'>
            Automatic strategy selection · Always a human at the end of the
            line.
          </p>
        </section>

        {/* ---------- Showcase: panels flanking the waitlist CTA ---------- */}
        <section className='showcase' aria-label='What Equilibris does'>
          <div className='feature-col'>
            <article className='feature'>
              <span className='tag'>/ complexity, handled</span>
              <h3>Made for the complicated</h3>
              <p>
                Side businesses, rental properties, K-1s, equity comp. The
                messier your situation, the more there is to optimize.
              </p>
            </article>
            <article className='feature'>
              <span className='tag'>/ strategy engine</span>
              <h3>Automatic strategy selection</h3>
              <p>
                Our engine models your year and surfaces the moves that actually
                move the needle — before the deadline, not after.
              </p>
            </article>
          </div>

          <section className='cta' id='waitlist' aria-label='Join the waitlist'>
            <h2>
              Join the <span className='pop'>Waitlist</span> Today!
            </h2>
            <p className='cta-sub'>
              Be first in line when Equilibris opens. Spots in the private beta
              are limited.
            </p>
            <WaitlistForm />
          </section>

          <div className='feature-col'>
            <article className='feature'>
              <span className='tag'>/ real people</span>
              <h3>A human at the end</h3>
              <p>
                Software does the heavy lifting; a real, credentialed person
                signs off. You&apos;re never left talking to a chatbot.
              </p>
            </article>
            <article className='feature'>
              <span className='tag'>/ real time</span>
              <h3>Your Data there Now</h3>
              <p>We maintain real time computations of your tax liabilities.</p>
            </article>
          </div>
        </section>

        {/* ---------- Footer ---------- */}
        <footer className='footer'>
          <p>© 2026 Equilibris Inc</p>
        </footer>
      </div>
    </>
  )
}
