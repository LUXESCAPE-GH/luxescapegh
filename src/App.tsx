import { createContext, useContext, useEffect, useRef, useState } from 'react'
import {
  addDoc, collection, deleteDoc, deleteField, doc, getDoc, onSnapshot, orderBy, query, runTransaction,
  serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore'
import {
  createUserWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged,
  sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword,
  signInWithPopup, signOut, updateProfile, type User,
} from 'firebase/auth'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Check,
  Compass, MapPin, Menu, MessageCircle,
  Minus, MoveUpRight, Plus, ShieldCheck, Sparkles, Users, X,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { auth, db, isFirebaseConfigured, missingFirebaseSettings } from './firebase'
import './App.css'

type Trip = {
  id: string
  title: string
  destination: string
  region: string
  description: string
  image: string
  originalImage?: string
  cloudinaryPublicId?: string
  imagePositionX?: number
  imagePositionY?: number
  imageZoom?: number
  price: number
  capacity: number
  reservedSeats: number
  startDate: string
  endDate: string
  published: boolean
}

type Experience = {
  title: string
  kind: string
  place: string
  image: string
  className?: string
  imageFit?: Partial<ImageFit>
}

type SiteMedia = {
  id: string
  url?: string
  cloudinaryPublicId?: string
  heroEyebrow?: string
  heroHeadline?: string
  heroHeadlineEmphasis?: string
  heroDescription?: string
  experienceTitle?: string
  experienceKind?: string
  experiencePlace?: string
  imagePositionX?: number
  imagePositionY?: number
  imageZoom?: number
}
type GalleryAlbum = { id: string; title: string; description?: string; location?: string; coverUrl?: string; coverPublicId?: string; imagePositionX?: number; imagePositionY?: number; imageZoom?: number; published: boolean; createdAt?: { toMillis: () => number } }
type GalleryMedia = { id: string; albumId?: string; title: string; caption?: string; type: 'image' | 'video'; url: string; cloudinaryPublicId?: string; imagePositionX?: number; imagePositionY?: number; imageZoom?: number; published: boolean; createdAt?: { toMillis: () => number } }
type ImageFit = { imagePositionX: number; imagePositionY: number; imageZoom: number }
type ChatMessage = { id: string; text: string; senderId: string; createdAt?: { toDate: () => Date } }
const ADMIN_EMAIL = 'luxescape111@gmail.com'
const CURRENT_YEAR = new Date().getFullYear()
const PublicMediaContext = createContext<{ siteMedia: Record<string, SiteMedia>; galleryMedia: GalleryMedia[]; galleryAlbums: GalleryAlbum[] }>({ siteMedia: {}, galleryMedia: [], galleryAlbums: [] })

async function logout() {
  if (auth) await signOut(auth)
}

const photos = {
  hero: [
    { title: 'Find your way to wonder.', place: 'KAKUM NATIONAL PARK', image: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=2200&q=85' },
    { title: 'A slower kind of beautiful.', place: 'GHANA, IN FULL COLOUR', image: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=2200&q=85' },
    { title: 'Take the scenic way.', place: 'THE COAST OF GHANA', image: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=2200&q=85' },
  ],
  experience: [
    { title: 'The call of the wild', kind: 'NATURE & WILDLIFE', place: 'Mole National Park', image: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=1100&q=85' },
    { title: 'A little more coastline', kind: 'BEACH ESCAPES', place: 'Ghana’s Western Coast', image: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1100&q=85' },
    { title: 'Where the forest opens', kind: 'ADVENTURE', place: 'Kakum, Central Region', image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1100&q=85' },
  ],
}

const SITE_IMAGE_SLOTS = [
  { id: 'brand-logo', title: 'Website logo', placement: 'Header, account and footer', type: 'image' },
  { id: 'hero-1', title: 'Hero slide 1', placement: 'Homepage opening slideshow', type: 'image' },
  { id: 'hero-2', title: 'Hero slide 2', placement: 'Homepage opening slideshow', type: 'image' },
  { id: 'hero-3', title: 'Hero slide 3', placement: 'Homepage opening slideshow', type: 'image' },
  { id: 'about-feature', title: 'About feature', placement: 'About section feature photo', type: 'image' },
  { id: 'experience-1', title: 'Experience card 1', placement: 'Experience cards', type: 'image' },
  { id: 'experience-2', title: 'Experience card 2', placement: 'Experience cards', type: 'image' },
  { id: 'experience-3', title: 'Experience card 3', placement: 'Experience cards', type: 'image' },
  { id: 'quote-background', title: 'Closing feature', placement: 'Homepage closing quote section', type: 'image' },
]
const MAX_MEDIA_SIZE = 20 * 1024 * 1024 - 1
const SITE_MEDIA_CACHE_KEY = 'lux-escape-published-site-media-v1'

function readCachedSiteMedia(): Record<string, SiteMedia> {
  try {
    const raw = window.localStorage.getItem(SITE_MEDIA_CACHE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return Object.fromEntries(SITE_IMAGE_SLOTS.flatMap((slot) => {
      const item = (parsed as Record<string, unknown>)[slot.id]
      if (typeof item !== 'object' || item === null) return []
      const cached = item as Record<string, unknown>
      const media: SiteMedia = { id: slot.id }
      if (typeof cached.url === 'string' && /^https?:\/\//i.test(cached.url)) media.url = cached.url
      if (typeof cached.cloudinaryPublicId === 'string') media.cloudinaryPublicId = cached.cloudinaryPublicId
      for (const key of ['heroEyebrow', 'heroHeadline', 'heroHeadlineEmphasis', 'heroDescription', 'experienceTitle', 'experienceKind', 'experiencePlace'] as const) {
        if (typeof cached[key] === 'string') media[key] = cached[key]
      }
      for (const key of ['imagePositionX', 'imagePositionY', 'imageZoom'] as const) {
        if (typeof cached[key] === 'number' && Number.isFinite(cached[key])) media[key] = cached[key]
      }
      return Object.keys(media).length > 1 ? [[slot.id, media]] : []
    }))
  } catch (reason) {
    console.warn('Unable to read cached website images:', reason)
    return {}
  }
}

function defaultSiteImage(slotId: string) {
  if (slotId === 'brand-logo') return '/images/logo.png'
  if (slotId.startsWith('hero-')) return photos.hero[Number(slotId.slice(-1)) - 1]?.image || photos.hero[0].image
  if (slotId.startsWith('experience-')) return photos.experience[Number(slotId.slice(-1)) - 1]?.image || photos.experience[0].image
  if (slotId === 'about-feature') return 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1800&q=85'
  return 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2000&q=85'
}

function imageFitStyle(item?: Partial<ImageFit>): React.CSSProperties {
  if (item?.imagePositionX === undefined && item?.imagePositionY === undefined && item?.imageZoom === undefined) return {}
  const positionX = typeof item?.imagePositionX === 'number' && Number.isFinite(item.imagePositionX) ? Math.max(0, Math.min(100, item.imagePositionX)) : 50
  const positionY = typeof item?.imagePositionY === 'number' && Number.isFinite(item.imagePositionY) ? Math.max(0, Math.min(100, item.imagePositionY)) : 50
  const zoom = typeof item?.imageZoom === 'number' && Number.isFinite(item.imageZoom) ? Math.max(1, Math.min(2.5, item.imageZoom)) : 1
  return {
    objectPosition: `${positionX}% ${positionY}%`,
    scale: String(zoom),
    transformOrigin: `${positionX}% ${positionY}%`,
  }
}

function siteImageAspectRatio(slotId: string) {
  if (slotId.startsWith('hero-')) return 16 / 7
  if (slotId === 'brand-logo') return 4
  if (slotId === 'about-feature') return 1.2
  if (slotId === 'experience-1') return 1
  if (slotId === 'experience-2') return 1
  if (slotId === 'experience-3') return 0.86
  if (slotId === 'quote-background') return 2
  return 1.5
}

function siteImageMobileAspectRatio(slotId: string) {
  if (slotId.startsWith('hero-')) return 0.8
  if (slotId === 'about-feature') return 1.17
  if (slotId === 'experience-1' || slotId === 'experience-3') return 0.6
  if (slotId === 'experience-2') return 1.12
  if (slotId === 'quote-background') return 1
  return siteImageAspectRatio(slotId)
}

async function uploadPublicMedia(file: File) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  if (!cloudName || !uploadPreset) throw new Error('Cloudinary is not configured. Add the cloud name and unsigned upload preset to .env.local, then restart the dev server.')
  if (file.size > MAX_MEDIA_SIZE) throw new Error('Choose a file smaller than 20 MB.')
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) throw new Error('Choose an image or video file.')
  const resourceType = file.type.startsWith('video/') ? 'video' : 'image'
  const body = new FormData()
  body.append('file', file)
  body.append('upload_preset', uploadPreset)
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${resourceType}/upload`, { method: 'POST', body })
  const result = await response.json().catch(() => null) as { secure_url?: unknown; public_id?: unknown; error?: { message?: string } } | null
  if (!response.ok) throw new Error(result?.error?.message || `Cloudinary upload failed (${response.status}).`)
  if (typeof result?.secure_url !== 'string' || typeof result.public_id !== 'string') throw new Error('Cloudinary returned an incomplete upload response.')
  return { url: result.secure_url, cloudinaryPublicId: result.public_id }
}

function uploadErrorMessage(reason: unknown) {
  if (reason instanceof TypeError && reason.message.toLowerCase().includes('fetch')) {
    return 'Could not reach Cloudinary. Check your internet connection, Cloudinary cloud name, and browser network settings, then try again.'
  }
  return firebaseMessage(reason)
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    if (!auth) {
      setAuthReady(true)
      return
    }
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setAuthReady(true)
    })
  }, [])

  return (
    <BrowserRouter>
      <RouteMetadata />
      <PublicMediaProvider>
        <Routes>
          <Route path="/admin/*" element={<AdminPage user={user} authReady={authReady} />} />
          <Route path="/account/*" element={<AccountPage user={user} authReady={authReady} />} />
          <Route path="/trips/:tripId" element={<TripPage user={user} />} />
          <Route path="/memories/:albumId" element={<MemoryPlaylistPage user={user} />} />
          <Route path="/memories" element={<MemoriesPage user={user} />} />
          <Route path="*" element={<HomePage user={user} authReady={authReady} />} />
        </Routes>
      </PublicMediaProvider>
    </BrowserRouter>
  )
}

function PublicMediaProvider({ children }: { children: React.ReactNode }) {
  const [siteMedia, setSiteMedia] = useState<Record<string, SiteMedia>>(readCachedSiteMedia)
  const [galleryMedia, setGalleryMedia] = useState<GalleryMedia[]>([])
  const [galleryAlbums, setGalleryAlbums] = useState<GalleryAlbum[]>([])
  useEffect(() => {
    if (!db) return
    const stopSiteMedia = onSnapshot(query(collection(db, 'websiteContent'), where('published', '==', true)), (snapshot) => {
      if (snapshot.metadata.fromCache && snapshot.empty) return
      const nextSiteMedia = Object.fromEntries(snapshot.docs.map((item) => [item.id, { id: item.id, ...item.data() } as SiteMedia]))
      setSiteMedia(nextSiteMedia)
      if (!snapshot.metadata.fromCache) {
        try { window.localStorage.setItem(SITE_MEDIA_CACHE_KEY, JSON.stringify(nextSiteMedia)) }
        catch (reason) { console.warn('Unable to cache published website images:', reason) }
      }
    }, (error) => console.error('Unable to load website media:', error))
    const stopGallery = onSnapshot(query(collection(db, 'galleryMedia'), where('published', '==', true)), (snapshot) => {
      setGalleryMedia(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as GalleryMedia)).sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)))
    }, (error) => console.error('Unable to load memories gallery:', error))
    const stopGalleryAlbums = onSnapshot(query(collection(db, 'galleryAlbums'), where('published', '==', true)), (snapshot) => {
      setGalleryAlbums(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as GalleryAlbum)).sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)))
    }, (error) => console.error('Unable to load memories playlists:', error))
    return () => { stopSiteMedia(); stopGallery(); stopGalleryAlbums() }
  }, [])
  return <PublicMediaContext.Provider value={{ siteMedia, galleryMedia, galleryAlbums }}>{children}</PublicMediaContext.Provider>
}

function RouteMetadata() {
  const { pathname } = useLocation()
  useEffect(() => {
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (robots) robots.content = pathname.startsWith('/account') || pathname.startsWith('/admin') ? 'noindex, nofollow' : 'index, follow'
    document.title = pathname.startsWith('/memories')
      ? 'Memories | LUX ESCAPE — Ghana'
      : 'LUX ESCAPE — Luxury, Retreats & Adventures in Ghana'
  }, [pathname])
  return null
}

function Brand({ inverse = false, adaptColor = false, logoOnLight = false }: { inverse?: boolean; adaptColor?: boolean; logoOnLight?: boolean }) {
  const { siteMedia } = useContext(PublicMediaContext)
  const logo = siteMedia['brand-logo']?.url || '/images/logo.png'
  return <Link className={`brand ${inverse ? 'brand-inverse' : ''}`} to="/" aria-label="Lux Escape home">
    <span className="brand-logo-frame">
      <img className="brand-logo-image" src={logo} alt="LUX ESCAPE — Luxury Retreats & Adventures" />
      {adaptColor && <img className={`brand-logo-image brand-logo-image-burgundy ${logoOnLight ? 'is-visible' : ''}`} src={logo} alt="" aria-hidden="true" />}
    </span>
  </Link>
}

function Header({ user, onAuth, overHero = false }: { user: User | null; onAuth: () => void; overHero?: boolean }) {
  const [scrolled, setScrolled] = useState(false)
  const [logoOnLightBackground, setLogoOnLightBackground] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const isScrolled = window.scrollY > 24
        setScrolled(isScrolled)
        if (!isScrolled) {
          setLogoOnLightBackground(false)
          return
        }

        const header = document.querySelector('.site-header')
        const logo = header?.querySelector('.brand-logo-frame')
        const bounds = logo?.getBoundingClientRect()
        if (!bounds) return

        const x = bounds.left + bounds.width / 2
        const y = Math.min(window.innerHeight - 1, bounds.bottom + 10)
        const layers = document.elementsFromPoint(x, y).filter((element) => !element.closest('.site-header'))
        let isLight = false
        for (const layer of layers) {
          if (layer instanceof HTMLImageElement || layer.closest('img, .hero-photo, .intro-visual, .experience-card, .trip-image, .trip-detail-hero, .quote-section')) break
          let current: HTMLElement | null = layer instanceof HTMLElement ? layer : null
          while (current && !current.closest('.site-header')) {
            const style = window.getComputedStyle(current)
            if (style.backgroundImage !== 'none') {
              current = null
              break
            }
            const match = style.backgroundColor.match(/rgba?\(([^)]+)\)/)
            if (match) {
              const channels = match[1].split(/[,\s/]+/).filter(Boolean).map(Number)
              const alpha = channels.length > 3 ? channels[3] : 1
              if (alpha > 0.5) {
                const [red, green, blue] = channels
                isLight = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255 > 0.72
                current = null
                break
              }
            }
            current = current.parentElement
          }
          if (current === null) break
        }
        setLogoOnLightBackground(isLight)
      })
    }
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    update()
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  const links = [['About', '/#about'], ['Experiences', '/#experiences'], ['Upcoming events & trips', '/#trips'], ['Memories', '/memories'], ['Contact', '/#contact']]
  return <header className={`site-header ${scrolled ? 'is-scrolled' : ''} ${logoOnLightBackground ? 'logo-on-light' : ''} ${overHero ? 'site-header-over-hero' : ''}`}>
    <div className="nav-shell">
      <Brand inverse={overHero && !scrolled} adaptColor={scrolled} logoOnLight={logoOnLightBackground} />
      <div className={`nav-dock ${menuOpen ? 'menu-open' : ''}`}>
        <nav className={`nav-links ${menuOpen ? 'menu-open' : ''}`} aria-label="Main navigation">
          {links.map(([label, href]) => <a href={href} key={href} onClick={() => setMenuOpen(false)}>{label}</a>)}
          {user && <Link className="mobile-nav-link mobile-account-link" to="/account" onClick={() => setMenuOpen(false)}>{user.displayName?.split(' ')[0] || 'My account'} <ArrowUpRight size={15} /></Link>}
          <button className="mobile-nav-link nav-login" onClick={() => { setMenuOpen(false); if (user) void logout(); else onAuth() }}>{user ? 'Sign out' : 'Sign in'}</button>
        </nav>
        <div className="nav-actions">
          {user ? <Link to="/account" className="nav-account">{user.displayName?.split(' ')[0] || 'My account'} <ArrowUpRight size={15} /></Link>
            : <button className="nav-login" onClick={onAuth}>Sign in</button>}
        </div>
      </div>
      <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}>
        {menuOpen ? <X /> : <Menu />}
      </button>
    </div>
  </header>
}

function HomePage({ user, authReady }: { user: User | null; authReady: boolean }) {
  const { siteMedia } = useContext(PublicMediaContext)
  const [authOpen, setAuthOpen] = useState(false)
  const [authIntent, setAuthIntent] = useState<'login' | 'register'>('register')
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [trips, setTrips] = useState<Trip[]>([])
  const reducedMotion = useReducedMotion()
  const [slide, setSlide] = useState(0)
  const heroSwipe = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  const heroPhotos = photos.hero.map((photo, index) => {
    const media = siteMedia[`hero-${index + 1}`]
    return {
      ...photo,
      image: media?.url || photo.image,
      imageFit: media,
      eyebrow: media?.heroEyebrow || photo.place,
      headline: media?.heroHeadline || '',
      headlineEmphasis: media?.heroHeadlineEmphasis || '',
      description: media?.heroDescription || '',
    }
  })
  const experiencePhotos = photos.experience.map((photo, index) => {
    const media = siteMedia[`experience-${index + 1}`]
    return {
      ...photo,
      image: media?.url || photo.image,
      title: media?.experienceTitle || photo.title,
      kind: media?.experienceKind || photo.kind,
      place: media?.experiencePlace || photo.place,
      imageFit: media,
    }
  })

  useEffect(() => {
    if (reducedMotion || heroPhotos.length < 2) return
    const timer = window.setTimeout(() => setSlide((value) => (value + 1) % heroPhotos.length), 7000)
    return () => window.clearTimeout(timer)
  }, [reducedMotion, heroPhotos.length, slide])

  const moveHero = (direction: -1 | 1) => setSlide((current) => (current + direction + heroPhotos.length) % heroPhotos.length)
  const startHeroSwipe = (event: React.PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('a, button, input, textarea')) {
      heroSwipe.current = null
      return
    }
    heroSwipe.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }
  }
  const finishHeroSwipe = (event: React.PointerEvent<HTMLElement>) => {
    const start = heroSwipe.current
    heroSwipe.current = null
    if (!start || start.pointerId !== event.pointerId) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.25) return
    moveHero(dx < 0 ? 1 : -1)
  }

  useEffect(() => {
    if (!db) return
    const liveTrips = query(collection(db, 'events'), where('published', '==', true), orderBy('startDate', 'asc'))
    return onSnapshot(liveTrips, (snapshot) => {
      setTrips(snapshot.docs.map((event) => ({ id: event.id, ...event.data() } as Trip)))
    }, (error) => console.error('Unable to load upcoming trips:', error))
  }, [])

  const openAuth = (intent: 'login' | 'register' = 'register') => {
    setAuthIntent(intent)
    setAuthOpen(true)
  }
  const book = (trip: Trip) => {
    if (!user) {
      setAuthIntent('register')
      setAuthOpen(true)
      return
    }
    setSelectedTrip(trip)
  }

  return <div className="app-shell">
    <Header user={user} onAuth={() => openAuth('login')} overHero />
    <main>
      <section className="hero-section" onPointerDown={startHeroSwipe} onPointerUp={finishHeroSwipe} onPointerCancel={() => { heroSwipe.current = null }}>
        <AnimatePresence mode="sync">
          <motion.div key={slide} className="hero-photo"
            initial={{ opacity: 0, scale: reducedMotion ? 1 : 1.035 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.25, ease: 'easeInOut' }}>
            <img src={heroPhotos[slide]?.image || photos.hero[0].image} alt="" style={imageFitStyle(heroPhotos[slide]?.imageFit)} />
          </motion.div>
        </AnimatePresence>
        <div className="hero-shade" />
        <div className="hero-content page-width">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="eyebrow eyebrow-light"><span /> {heroPhotos[slide]?.eyebrow || photos.hero[0].place}</div>
            <h1>{heroPhotos[slide]?.headline || (user && authReady ? 'Welcome back.' : 'A little further.')}<br /><em>{heroPhotos[slide]?.headlineEmphasis || (user && authReady ? 'Where to next?' : 'A lot more alive.')}</em></h1>
            <p>{heroPhotos[slide]?.description || 'Thoughtfully curated escapes for those who want to feel a place, not just see it.'}</p>
          </motion.div>
        </div>
        <div className="hero-meta page-width">
          <div className="hero-slider-controls">
            <button className="hero-arrow" onClick={() => moveHero(-1)} aria-label="Previous hero image"><ArrowLeft size={15} /></button>
            <div className="hero-dots" aria-label="Choose hero image">{heroPhotos.map((item, index) => <button key={item.place} className={index === slide ? 'active' : ''} onClick={() => setSlide(index)} aria-label={`Show ${item.place}`} aria-current={index === slide ? 'true' : undefined} />)}</div>
            <button className="hero-arrow" onClick={() => moveHero(1)} aria-label="Next hero image"><ArrowRight size={15} /></button>
          </div>
          <span>GHANA, BEAUTIFULLY DISCOVERED</span>
        </div>
        <div className="hero-side-note">MADE FOR THE MOMENTS THAT STAY</div>
      </section>

      <section className="intro-section page-width" id="about">
        <div className="intro-kicker"><span className="eyebrow">A DIFFERENT KIND OF GETAWAY</span><span className="line" /></div>
        <div className="intro-grid">
          <h2>Not just a place.<br />A feeling you <em>take home.</em></h2>
          <div className="intro-copy">
            <p>We believe the best journeys make room for wonder. LUX ESCAPE brings people together to discover Ghana through considered adventures, restorative retreats and the little moments in between.</p>
            <a href="#experiences" className="text-link">A little about us <ArrowUpRight size={15} /></a>
          </div>
        </div>
        <div className="intro-visual">
          <img src={siteMedia['about-feature']?.url || 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1800&q=85'} alt="Golden light over a quiet mountain lake" loading="lazy" style={imageFitStyle(siteMedia['about-feature'])} />
          <div className="visual-caption"><span>01 / THE ART OF GETTING AWAY</span><span>Take the long way. It’s worth it.</span></div>
          <div className="intro-seal"><Sparkles size={16} /><span>CURATED<br />WITH CARE</span></div>
        </div>
        <div className="values-row">
          <div><span>01</span><b>Thoughtfully curated</b><p>Every detail, with intention.</p></div>
          <div><span>02</span><b>Better together</b><p>Good company comes standard.</p></div>
          <div><span>03</span><b>Rooted in Ghana</b><p>Local knowledge. Lasting impact.</p></div>
          <div><span>04</span><b>Room to unwind</b><p>Adventure, at your own pace.</p></div>
        </div>
      </section>

      <section className="experiences-section" id="experiences">
        <div className="page-width">
          <div className="section-heading">
            <div><span className="eyebrow">THE GOOD KIND OF GETTING LOST</span><h2>Find your kind<br />of <em>somewhere.</em></h2></div>
            <p>From green canopies to salt-air afternoons, find the kind of escape that feels like yours.</p>
          </div>
          <div className="experience-grid">
            {experiencePhotos.map((item, i) => <ExperienceCard item={item} index={i} key={item.title} />)}
          </div>
          <a className="text-link experience-more" href="#trips">Explore all experiences <ArrowUpRight size={16} /></a>
        </div>
      </section>

      <section className="trips-section page-width" id="trips">
        <div className="section-heading trips-heading">
          <div><span className="eyebrow">UPCOMING EVENTS & TRIPS</span><h2>Come along<br />for the <em>journey.</em></h2></div>
          <p>Discover curated group trips, retreats and special events across Ghana.</p>
        </div>
        {!isFirebaseConfigured && <div className="cms-notice"><ShieldCheck size={18} /><span>New escapes and events are being prepared. Check back soon for upcoming events and trips.</span></div>}
        {isFirebaseConfigured && trips.length === 0 && <div className="empty-trips"><Compass size={27} /><h3>Your next story is still being written.</h3><p>There are no upcoming events or trips just yet. Check back soon.</p></div>}
        {trips.length > 0 && <div className="trip-grid">{trips.slice(0, 3).map((trip) => <TripCard key={trip.id} trip={trip} onBook={() => book(trip)} />)}</div>}
        <a href="#contact" className="text-link trips-link">Curious about a private escape? <ArrowUpRight size={15} /></a>
      </section>

      <section className="quote-section">
        <img src={siteMedia['quote-background']?.url || 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2000&q=85'} alt="" loading="lazy" style={imageFitStyle(siteMedia['quote-background'])} />
        <div className="quote-overlay" />
        <div className="quote-content"><span className="eyebrow eyebrow-light">THE LUX ESCAPE WAY</span><p>“The best souvenirs<br />are the <em>stories you bring back.</em>”</p><span className="quote-caption">YOUR NEXT CHAPTER STARTS HERE</span><a className="button button-light" href="#trips">Let’s make a memory <ArrowUpRight size={15} /></a></div>
      </section>

      <Footer />
    </main>
    <SupportChat user={user} onSignIn={() => openAuth('login')} />
    <AnimatePresence>{authOpen && <AuthModal initialMode={authIntent} close={() => setAuthOpen(false)} />}</AnimatePresence>
    <AnimatePresence>{selectedTrip && <BookingModal trip={selectedTrip} user={user} close={() => setSelectedTrip(null)} />}</AnimatePresence>
  </div>
}

function ExperienceCard({ item, index }: { item: Experience; index: number }) {
  return <a className={`experience-card experience-${index + 1}`} href="#trips">
    <img src={item.image} alt={`${item.title} — ${item.place}`} loading="lazy" style={imageFitStyle(item.imageFit)} />
    <div className="experience-wash" />
    <span className="experience-index">0{index + 1}</span><span className="experience-kind">{item.kind}</span>
    <div className="experience-card-bottom"><div><h3>{item.title}</h3><span><MapPin size={13} /> {item.place}</span></div><i><ArrowUpRight size={18} /></i></div>
  </a>
}

function MemoriesPage({ user }: { user: User | null }) {
  const { galleryMedia, galleryAlbums } = useContext(PublicMediaContext)
  const [authOpen, setAuthOpen] = useState(false)
  const legacyMedia = galleryMedia.filter((item) => !item.albumId)
  const playlists = [
    ...galleryAlbums.map((album) => ({
      id: album.id,
      title: album.title,
      description: album.description || '',
      location: album.location || '',
      coverUrl: album.coverUrl || galleryMedia.find((item) => item.albumId === album.id)?.url || '',
      coverFit: album,
      count: galleryMedia.filter((item) => item.albumId === album.id).length,
    })),
    ...(legacyMedia.length ? [{
      id: 'legacy',
      title: 'Earlier memories',
      description: 'Moments shared before our memories were organized into playlists.',
      location: '',
      coverUrl: legacyMedia[0].url,
      coverFit: legacyMedia[0],
      count: legacyMedia.length,
    }] : []),
  ]

  return <div className="app-shell">
    <Header user={user} onAuth={() => setAuthOpen(true)} />
    <main className="memories-page">
      <section className="memories-heading page-width">
        <span className="eyebrow">LITTLE MOMENTS. BIG MEMORIES.</span>
        <h1>Some places<br />stay with <em>you.</em></h1>
        <p>Choose an escape and revisit every photo and video from that trip.</p>
        <span className="memories-count">{playlists.length} {playlists.length === 1 ? 'PLAYLIST' : 'PLAYLISTS'}</span>
      </section>
      <section className="memories-gallery page-width" aria-label="Memories playlists">
        {playlists.length === 0
          ? <div className="memories-empty"><Compass size={30} /><h2>Every great story starts somewhere.</h2><p>Playlists from our past escapes will appear here.</p></div>
          : playlists.map((playlist) => <Link className="memory-playlist-card" to={`/memories/${playlist.id}`} key={playlist.id}>
            <div className="memory-playlist-cover">
              <img src={playlist.coverUrl} alt="" loading="lazy" style={imageFitStyle(playlist.coverFit)} />
              <span className="memory-playlist-count">{playlist.count} {playlist.count === 1 ? 'MEMORY' : 'MEMORIES'}</span>
            </div>
            <div className="memories-gallery-caption"><span>{playlist.location || 'LUX ESCAPE JOURNAL'}</span><h2>{playlist.title}</h2>{playlist.description && <p>{playlist.description}</p>}<span className="memory-playlist-open">OPEN PLAYLIST <ArrowUpRight size={14} /></span></div>
          </Link>)}
      </section>
    </main>
    <Footer />
    <SupportChat user={user} onSignIn={() => setAuthOpen(true)} />
    <AnimatePresence>{authOpen && <AuthModal initialMode="login" close={() => setAuthOpen(false)} />}</AnimatePresence>
  </div>
}

function MemoryPlaylistPage({ user }: { user: User | null }) {
  const { albumId = '' } = useParams()
  const { galleryMedia, galleryAlbums } = useContext(PublicMediaContext)
  const [authOpen, setAuthOpen] = useState(false)
  const legacy = albumId === 'legacy'
  const album = galleryAlbums.find((item) => item.id === albumId)
  const items = galleryMedia.filter((item) => legacy ? !item.albumId : item.albumId === albumId)

  return <div className="app-shell">
    <Header user={user} onAuth={() => setAuthOpen(true)} />
    <main className="memories-page">
      <section className="memories-heading page-width">
        <Link className="memory-back-link" to="/memories"><ArrowLeft size={14} /> ALL PLAYLISTS</Link>
        <span className="eyebrow">{album?.location || (legacy ? 'FROM OUR ARCHIVE' : 'LUX ESCAPE MEMORIES')}</span>
        <h1>{album?.title || (legacy ? 'Earlier memories' : 'Playlist')}</h1>
        <p>{album?.description || (legacy ? 'Moments shared before our memories were organized into playlists.' : 'Explore photos and videos from this escape.')}</p>
        <span className="memories-count">{items.length} {items.length === 1 ? 'MEMORY' : 'MEMORIES'}</span>
      </section>
      <section className="memories-gallery page-width" aria-label={`Memories from ${album?.title || 'this playlist'}`}>
        {!album && !legacy
          ? <div className="memories-empty"><Compass size={30} /><h2>We couldn’t find that playlist.</h2><Link to="/memories">Back to all playlists</Link></div>
          : items.length === 0
            ? <div className="memories-empty"><Compass size={30} /><h2>This playlist is on its way.</h2><p>Photos and videos from this escape will appear here.</p></div>
            : items.map((item) => <article className="memories-gallery-card" key={item.id}>
              {item.type === 'video'
                ? <video src={item.url} aria-label={item.title} controls playsInline preload="metadata" />
                : <img src={item.url} alt={item.title} loading="lazy" style={imageFitStyle(item)} />}
              <div className="memories-gallery-caption"><h2>{item.title}</h2>{item.caption && <p>{item.caption}</p>}</div>
            </article>)}
      </section>
    </main>
    <Footer />
    <SupportChat user={user} onSignIn={() => setAuthOpen(true)} />
    <AnimatePresence>{authOpen && <AuthModal initialMode="login" close={() => setAuthOpen(false)} />}</AnimatePresence>
  </div>
}

function TripCard({ trip, onBook }: { trip: Trip; onBook: () => void }) {
  const remaining = Math.max(0, trip.capacity - (trip.reservedSeats || 0))
  const date = trip.startDate ? new Date(`${trip.startDate}T00:00:00`).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date to be announced'
  return <article className="trip-card">
    <Link to={`/trips/${trip.id}`} className="trip-image"><img src={trip.image || photos.experience[0].image} alt={trip.title} loading="lazy" style={imageFitStyle(trip)} /><span className={`trip-status ${remaining < 5 ? 'trip-few' : ''}`}>{remaining ? remaining < 5 ? 'FILLING FAST' : 'BOOKINGS OPEN' : 'FULLY BOOKED'}</span><span className="trip-arrow"><ArrowUpRight size={18} /></span></Link>
    <div className="trip-card-content"><span className="trip-region"><MapPin size={13} /> {trip.region || trip.destination}</span><Link to={`/trips/${trip.id}`}><h3>{trip.title}</h3></Link><p>{trip.description}</p>
      <div className="trip-info"><span><CalendarDays size={14} /> {date}</span><span><Users size={14} /> {remaining} places left</span></div>
      <div className="trip-card-bottom"><strong>GH₵ {Number(trip.price || 0).toLocaleString('en-GH')} <small>/ person</small></strong><button className="trip-book" disabled={!remaining} onClick={onBook}>{remaining ? 'Plan your escape' : 'Fully booked'} <ArrowRight size={15} /></button></div>
    </div>
  </article>
}

function Footer() {
  return <footer className="site-footer" id="contact">
    <div className="footer-main page-width"><div className="footer-brand"><Brand inverse /><p>Thoughtfully curated escapes, rooted in Ghana and made for the moments that stay.</p><button className="footer-contact" onClick={() => window.dispatchEvent(new Event('lux-open-support'))}>Talk to our team <ArrowUpRight size={14} /></button></div>
      <div className="footer-links"><div><span>EXPLORE</span><a href="/#about">Our story</a><a href="/#experiences">Experiences</a><a href="/#trips">Upcoming events & trips</a><Link to="/memories">Memories</Link></div><div><span>GET IN TOUCH</span><button onClick={() => window.dispatchEvent(new Event('lux-open-support'))}>Customer support chat <ArrowUpRight size={13} /></button><a href="/#trips">Plan an escape <ArrowUpRight size={13} /></a></div></div></div>
    <div className="footer-bottom page-width"><span>© {CURRENT_YEAR} LUX ESCAPE. MADE WITH A LITTLE MORE THOUGHT.</span><span>GHANA <span className="footer-dot">●</span></span><a href="#top" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>BACK TO TOP ↑</a></div>
  </footer>
}

function Modal({ children, close, className = '' }: { children: React.ReactNode; close: () => void; className?: string }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previousOverflow }
  }, [close])
  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
    <motion.div className={`modal-card ${className}`} initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: 0.25 }} role="dialog" aria-modal="true">{children}</motion.div>
  </motion.div>
}

function ImagePositionDialog({ file, title, aspectRatio, mobileAspectRatio, onClose, onSave }: {
  file: File
  title: string
  aspectRatio: number
  mobileAspectRatio?: number
  onClose: () => void
  onSave: (fit: ImageFit) => Promise<boolean | string>
}) {
  const [previewUrl, setPreviewUrl] = useState('')
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)
  const [previewError, setPreviewError] = useState(false)
  const [position, setPosition] = useState({ x: 50, y: 50 })
  const [zoom, setZoom] = useState(1)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const previewRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; x: number; y: number; positionX: number; positionY: number } | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const previewAspectRatio = previewMode === 'mobile' && mobileAspectRatio ? mobileAspectRatio : aspectRatio
  const imageAspect = dimensions ? dimensions.width / dimensions.height : previewAspectRatio
  const imageWidth = Math.max(100, imageAspect / previewAspectRatio * 100) * zoom
  const imageHeight = Math.max(100, previewAspectRatio / imageAspect * 100) * zoom
  const canMoveX = imageWidth > 100.1
  const canMoveY = imageHeight > 100.1

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canMoveX && !canMoveY) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, positionX: position.x, positionY: position.y }
  }
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const bounds = previewRef.current?.getBoundingClientRect()
    if (!drag || drag.pointerId !== event.pointerId || !bounds) return
    const overflowX = Math.max(1, bounds.width * (imageWidth / 100 - 1))
    const overflowY = Math.max(1, bounds.height * (imageHeight / 100 - 1))
    setPosition({
      x: Math.max(0, Math.min(100, drag.positionX - ((event.clientX - drag.x) / overflowX) * 100)),
      y: Math.max(0, Math.min(100, drag.positionY - ((event.clientY - drag.y) / overflowY) * 100)),
    })
  }
  const save = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const result = await onSave({ imagePositionX: position.x, imagePositionY: position.y, imageZoom: zoom })
      if (result === true) onClose()
      else setSaveError(typeof result === 'string' ? result : 'The image could not be saved. Please try again.')
    } catch (reason) {
      setSaveError(firebaseMessage(reason))
    } finally { setSaving(false) }
  }

  return <Modal close={onClose} className="image-position-modal">
    <button className="modal-close" onClick={onClose} aria-label="Close image preview"><X size={20} /></button>
    <span className="eyebrow">POSITION YOUR IMAGE</span>
    <h2>{title}</h2>
    <p className="image-position-instructions">Drag the image inside the frame or use the controls. This preview matches the website’s image shape; the original image stays intact.</p>
    {mobileAspectRatio && <div className="image-preview-modes"><span>Preview as</span><button type="button" className={previewMode === 'desktop' ? 'active' : ''} onClick={() => setPreviewMode('desktop')}>Desktop</button><button type="button" className={previewMode === 'mobile' ? 'active' : ''} onClick={() => setPreviewMode('mobile')}>Mobile</button></div>}
    <div
      ref={previewRef}
      className={`image-position-preview ${canMoveX || canMoveY ? 'is-draggable' : ''}`}
      style={{ aspectRatio: String(previewAspectRatio) }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={() => { dragRef.current = null }}
      onPointerCancel={() => { dragRef.current = null }}
      onLostPointerCapture={() => { dragRef.current = null }}
    >
      {previewUrl && <img src={previewUrl} alt={`Preview of ${title}`} onLoad={(event) => setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} onError={() => setPreviewError(true)} style={{ width: `${imageWidth}%`, height: `${imageHeight}%`, left: `${(100 - imageWidth) * position.x / 100}%`, top: `${(100 - imageHeight) * position.y / 100}%` }} />}
      <span>LIVE PREVIEW</span>
    </div>
    {previewError && <p className="form-error">This image format can’t be previewed by your browser. Try a JPEG, PNG or WebP image.</p>}
    {saveError && <p className="form-error" role="alert">{saveError}</p>}
    <div className="image-position-controls">
      <label>Zoom <output>{zoom.toFixed(1)}×</output><input type="range" min="1" max="2.5" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
      <label>Horizontal position <output>{Math.round(position.x)}%</output><input type="range" min="0" max="100" value={position.x} disabled={!canMoveX} onChange={(event) => setPosition((value) => ({ ...value, x: Number(event.target.value) }))} /></label>
      <label>Vertical position <output>{Math.round(position.y)}%</output><input type="range" min="0" max="100" value={position.y} disabled={!canMoveY} onChange={(event) => setPosition((value) => ({ ...value, y: Number(event.target.value) }))} /></label>
    </div>
    <div className="image-position-actions"><button className="media-action" onClick={() => { setPosition({ x: 50, y: 50 }); setZoom(1) }}>Reset position</button><button className="button button-burgundy" onClick={() => void save()} disabled={saving || !dimensions || previewError}>{saving ? 'Uploading…' : 'Use this framing'} <ArrowRight size={15} /></button></div>
  </Modal>
}

async function requireAdminSignIn(user: User) {
  await user.reload()
  const token = await user.getIdTokenResult(true)
  if (user.email?.toLowerCase() !== ADMIN_EMAIL || token.claims.email_verified !== true) {
    if (auth) await signOut(auth)
    throw new Error(user.email?.toLowerCase() === ADMIN_EMAIL
      ? 'Verify this account’s email address before using the admin portal.'
      : 'This account is not authorized for the admin portal.')
  }
}

function AuthModal({ initialMode, close, returnTo = '/', adminOnly = false }: { initialMode: 'login' | 'register'; close: () => void; returnTo?: string; adminOnly?: boolean }) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(adminOnly ? 'login' : initialMode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const navigate = useNavigate()
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!auth) return setError('Authentication is not configured yet.')
    setBusy(true); setError(''); setNotice('')
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '').trim()
    try {
      if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email)
        setNotice('Password reset instructions are on their way.')
      } else if (mode === 'register') {
        const password = String(form.get('password') || '')
        if (password.length < 8) throw new Error('Choose a password with at least 8 characters.')
        if (password !== form.get('confirmPassword')) throw new Error('Those passwords don’t match.')
        const name = String(form.get('name') || '').trim()
        const credential = await createUserWithEmailAndPassword(auth, email, password)
        await updateProfile(credential.user, { displayName: name })
        await setDoc(doc(db!, 'users', credential.user.uid), { uid: credential.user.uid, displayName: name, email, phone: String(form.get('phone') || '').trim(), createdAt: serverTimestamp() })
        await sendEmailVerification(credential.user)
        close()
        navigate(returnTo)
      } else {
        const credential = await signInWithEmailAndPassword(auth, email, String(form.get('password') || ''))
        if (adminOnly) await requireAdminSignIn(credential.user)
        close()
        navigate(returnTo)
      }
    } catch (reason) {
      setError(firebaseMessage(reason))
    } finally { setBusy(false) }
  }
  const google = async () => {
    if (!auth) return setError('Authentication is not configured yet.')
    setBusy(true); setError('')
    try {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider())
      if (adminOnly) await requireAdminSignIn(credential.user)
      const profileRef = doc(db!, 'users', credential.user.uid)
      const profile = await getDoc(profileRef)
      if (!profile.exists()) {
        await setDoc(profileRef, { uid: credential.user.uid, displayName: credential.user.displayName || '', email: credential.user.email || '', phone: '', createdAt: serverTimestamp() })
      }
      close(); navigate(returnTo)
    } catch (reason) { setError(firebaseMessage(reason)) } finally { setBusy(false) }
  }
  return <Modal close={close} className="auth-modal">
    <button className="modal-close" onClick={close} aria-label="Close"><X size={20} /></button>
    <div className="auth-modal-mark"><Brand /></div>
    <span className="eyebrow">{adminOnly ? 'AUTHORIZED TEAM ACCESS' : mode === 'register' ? 'YOUR NEXT STORY STARTS HERE' : mode === 'forgot' ? 'A QUICK RESET' : 'GOOD TO HAVE YOU BACK'}</span>
    <h2>{adminOnly ? 'Admin sign in.' : mode === 'register' ? 'Make room for wonder.' : mode === 'forgot' ? 'Forgot your password?' : 'Welcome back.'}</h2>
    <p className="auth-lede">{adminOnly ? 'Sign in with an authorized LUX ESCAPE administrator account.' : mode === 'register' ? 'Create an account to save your place on the next escape.' : mode === 'forgot' ? 'We’ll send you a link to get back into your account.' : 'Sign in to pick up where your next escape left off.'}</p>
    <form onSubmit={submit} className="auth-form">
      {mode === 'register' && <><label>Your name<input name="name" autoComplete="name" required placeholder="e.g. Ama Mensah" /></label><label>Phone number<input name="phone" type="tel" autoComplete="tel" placeholder="+233 ..." required /></label></>}
      <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
      {mode !== 'forgot' && <label>Password<input name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'} minLength={mode === 'register' ? 8 : undefined} /></label>}
      {mode === 'register' && <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" required placeholder="Enter your password again" /></label>}
      {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
      <button className="button button-burgundy auth-submit" disabled={busy || !isFirebaseConfigured}>{busy ? 'One moment…' : mode === 'register' ? 'Create your account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'} <ArrowRight size={16} /></button>
    </form>
    {mode !== 'forgot' && <><div className="auth-divider"><span /> OR <span /></div><button className="google-button" onClick={google} disabled={busy || !isFirebaseConfigured}><span>G</span> Continue with Google</button></>}
    {!isFirebaseConfigured && <p className="config-hint">Add the missing Firebase Web App setting{missingFirebaseSettings.length === 1 ? '' : 's'} to <code>.env.local</code>: <code>{missingFirebaseSettings.join(', ')}</code>. Cloudinary keys do not enable Firebase sign in.</p>}
    {mode === 'forgot' ? <div className="auth-switch"><button onClick={() => { setMode('login'); setError('') }}>Back to sign in</button></div> : !adminOnly && <div className="auth-switch">{mode === 'register' ? <>Already a member? <button onClick={() => { setMode('login'); setError('') }}>Sign in</button></> : <>New around here? <button onClick={() => { setMode('register'); setError('') }}>Create an account</button></>}</div>}
    {mode === 'login' && <button className="forgot-link" onClick={() => { setMode('forgot'); setError('') }}>Forgot password?</button>}
  </Modal>
}

function BookingModal({ trip, user, close }: { trip: Trip; user: User | null; close: () => void }) {
  const [guests, setGuests] = useState(1)
  const [busy, setBusy] = useState(false)
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const available = Math.max(0, trip.capacity - (trip.reservedSeats || 0))
  const confirm = async () => {
    if (!user || !db) return setError('Please sign in before booking.')
    const firestore = db
    setBusy(true); setError('')
    const bookingRef = `LX-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    try {
      await runTransaction(firestore, async (transaction) => {
        const eventRef = doc(firestore, 'events', trip.id)
        const eventSnapshot = await transaction.get(eventRef)
        if (!eventSnapshot.exists()) throw new Error('This trip is no longer available.')
        const event = eventSnapshot.data()
        const seats = Number(event.reservedSeats || 0)
        const capacity = Number(event.capacity || 0)
        if (!event.published || capacity - seats < guests) throw new Error('There aren’t enough places left for your group.')
        const bookingRefDoc = doc(firestore, 'bookings', `${user.uid}_${trip.id}`)
        const existingBooking = await transaction.get(bookingRefDoc)
        if (existingBooking.exists()) throw new Error('You already have a reservation for this trip. Check your account for the booking details.')
        transaction.update(eventRef, { reservedSeats: seats + guests, updatedAt: serverTimestamp() })
        transaction.set(bookingRefDoc, { userId: user.uid, userName: user.displayName || '', userEmail: user.email || '', eventId: trip.id, eventTitle: trip.title, participants: guests, amount: Number(event.price || 0) * guests, currency: 'GHS', status: 'Pending', paymentStatus: 'Unpaid', reference: bookingRef, createdAt: serverTimestamp() })
      })
      setReference(bookingRef)
    } catch (reason) { setError(firebaseMessage(reason)) } finally { setBusy(false) }
  }
  return <Modal close={close} className="booking-modal">
    <button className="modal-close" onClick={close} aria-label="Close"><X size={20} /></button>
    {reference ? <div className="booking-success"><div className="success-check"><Check /></div><span className="eyebrow">YOUR REQUEST IS IN</span><h2>There’s a place<br />with your name on it.</h2><p>Your reservation request is pending. Our team will be in touch to confirm the details and payment.</p><div className="booking-reference">BOOKING REFERENCE <strong>{reference}</strong></div><button className="button button-burgundy" onClick={close}>Lovely, thank you <ArrowRight size={16} /></button></div>
      : <><div className="booking-image"><img src={trip.image || photos.experience[0].image} alt={trip.title} /></div><div className="booking-body"><span className="eyebrow">MAKE IT YOURS</span><h2>{trip.title}</h2><p className="booking-location"><MapPin size={14} /> {trip.destination}, {trip.region}</p><div className="booking-facts"><span><CalendarDays size={15} /> {trip.startDate || 'Date to be announced'}</span><span><Users size={15} /> {available} places left</span></div><div className="guest-selector"><div><strong>Travellers</strong><small>Who’s coming along?</small></div><div className="stepper"><button onClick={() => setGuests(Math.max(1, guests - 1))} aria-label="Remove traveller" disabled={guests <= 1}><Minus size={15} /></button><b>{guests}</b><button onClick={() => setGuests(Math.min(available, guests + 1))} aria-label="Add traveller" disabled={guests >= available}><Plus size={15} /></button></div></div><div className="booking-total"><span>Total · payment not taken yet</span><strong>GH₵ {(Number(trip.price) * guests).toLocaleString('en-GH')}</strong></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-burgundy booking-submit" onClick={confirm} disabled={busy || available < 1}>{busy ? 'Checking availability…' : 'Request a place'} <ArrowRight size={16} /></button><p className="booking-disclaimer">Your place is requested, not yet confirmed. We’ll share payment instructions after our team reviews your request.</p></div></>}
  </Modal>
}

function TripPage({ user }: { user: User | null }) {
  const { tripId = '' } = useParams()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [booking, setBooking] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  useEffect(() => {
    if (!db) { setLoaded(true); return }
    return onSnapshot(doc(db, 'events', tripId), (snapshot) => { setTrip(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Trip) : null); setLoaded(true) }, (error) => { console.error('Unable to load trip:', error); setLoaded(true) })
  }, [tripId])
  const onBook = () => user ? setBooking(true) : setAuthOpen(true)
  return <div className="app-shell"><Header user={user} onAuth={() => setAuthOpen(true)} />
    {loaded && trip ? <main className="trip-detail"><div className="trip-detail-hero"><img className="trip-detail-photo" src={trip.image || photos.experience[0].image} alt="" style={imageFitStyle(trip)} /><div className="trip-detail-shade" /><div className="trip-detail-title page-width"><Link to="/" className="back-link"><ArrowLeft size={15} /> Back to LUX ESCAPE</Link><span className="eyebrow eyebrow-light">{trip.region || trip.destination}</span><h1>{trip.title}</h1><p>{trip.description}</p></div></div><div className="trip-detail-content page-width"><div className="trip-detail-main"><span className="eyebrow">THE DETAILS</span><h2>Make some room<br />for <em>something special.</em></h2><p>{trip.description}</p></div><div className="trip-detail-aside"><div><CalendarDays /><span>DATES<strong>{trip.startDate || 'To be announced'}{trip.endDate ? ` — ${trip.endDate}` : ''}</strong></span></div><div><MapPin /><span>DESTINATION<strong>{trip.destination}, {trip.region}</strong></span></div><div><Users /><span>PLACES LEFT<strong>{Math.max(0, trip.capacity - (trip.reservedSeats || 0))}</strong></span></div><div className="detail-price"><span>FROM<strong>GH₵ {Number(trip.price || 0).toLocaleString('en-GH')} <small>/ person</small></strong></span><button className="button button-burgundy" onClick={onBook}>Plan your escape <ArrowRight size={16} /></button></div></div></div></main> : <main className="trip-detail-loading">{loaded ? <><h1>We couldn’t find this escape.</h1><Link to="/" className="text-link">Back to home <ArrowRight size={15} /></Link></> : <p>Finding your escape…</p>}</main>}
    <Footer /><SupportChat user={user} onSignIn={() => setAuthOpen(true)} />
    <AnimatePresence>{authOpen && <AuthModal initialMode="login" returnTo={`/trips/${tripId}`} close={() => setAuthOpen(false)} />}</AnimatePresence>
    <AnimatePresence>{booking && trip && <BookingModal trip={trip} user={user} close={() => setBooking(false)} />}</AnimatePresence>
  </div>
}

function AccountPage({ user, authReady }: { user: User | null; authReady: boolean }) {
  const [authOpen, setAuthOpen] = useState(false)
  const [bookings, setBookings] = useState<Record<string, unknown>[]>([])
  const [adminAccessError, setAdminAccessError] = useState('')
  const [checkingAdminAccess, setCheckingAdminAccess] = useState(false)
  const navigate = useNavigate()
  const openAdminPortal = async () => {
    if (!user) return
    setCheckingAdminAccess(true)
    setAdminAccessError('')
    try {
      await user.reload()
      const token = await user.getIdTokenResult(true)
      if (user.email?.toLowerCase() !== ADMIN_EMAIL) throw new Error('This account is not authorized for the admin portal.')
      if (token.claims.email_verified !== true) throw new Error('Verify this account’s email address before using the admin portal.')
      navigate('/admin')
    } catch (reason) {
      setAdminAccessError(firebaseMessage(reason))
    } finally {
      setCheckingAdminAccess(false)
    }
  }
  useEffect(() => {
    if (!db || !user) return
    return onSnapshot(query(collection(db, 'bookings'), where('userId', '==', user.uid), orderBy('createdAt', 'desc')), (snap) => setBookings(snap.docs.map((item) => ({ id: item.id, ...item.data() }))), (error) => console.error('Unable to load bookings:', error))
  }, [user])
  if (!authReady) return <div className="account-loading">One moment…</div>
  if (!user) return <div className="app-shell"><Header user={user} onAuth={() => setAuthOpen(true)} /><main className="auth-required page-width"><span className="eyebrow">YOUR LUX ESCAPE</span><h1>Your next story<br />starts <em>here.</em></h1><p>Sign in or create an account to view your trips and manage your bookings.</p><button className="button button-burgundy" onClick={() => setAuthOpen(true)}>Sign in or join us <ArrowRight size={16} /></button></main><Footer /><AnimatePresence>{authOpen && <AuthModal initialMode="login" returnTo="/account" close={() => setAuthOpen(false)} />}</AnimatePresence></div>
  return <div className="app-shell">
    <Header user={user} onAuth={() => void logout()} />
    <main className="account-page page-width">
      <div className="account-welcome">
        <span className="eyebrow">YOUR LITTLE CORNER OF LUX ESCAPE</span>
        <h1>Welcome back,<br /><em>{user.displayName?.split(' ')[0] || 'traveller'}.</em></h1>
        <p>Your next memory might be closer than you think.</p>
        <a className="button button-burgundy" href="/#trips">See upcoming events & trips <ArrowRight size={16} /></a>
      </div>
      <div className="account-bookings">
        <div className="account-section-heading">
          <div><span className="eyebrow">ALL YOUR PLANS, IN ONE PLACE</span><h2>Your bookings</h2></div>
          <span className="booking-count">{bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'}</span>
        </div>
        {bookings.length === 0 ? <div className="account-empty">
          <Compass size={26} /><h3>Nothing on the calendar. Yet.</h3><p>There’s a first time for everything.</p>
          <a className="text-link" href="/#trips">Find your first escape <ArrowRight size={15} /></a>
        </div> : <div className="account-booking-list">{bookings.map((item) => <article className="account-booking" key={String(item.id)}>
          <div className="booking-icon"><CalendarDays /></div>
          <div><span className="eyebrow">{String(item.reference || '')}</span><h3>{String(item.eventTitle || 'Your upcoming escape')}</h3><p>{String(item.participants || 1)} travellers · GH₵ {Number(item.amount || 0).toLocaleString('en-GH')}</p></div>
          <span className={`booking-status status-${String(item.status).toLowerCase()}`}>{String(item.status || 'Pending')}</span>
        </article>)}</div>}
      </div>
      <div className="account-profile">
        <div><span className="eyebrow">YOUR DETAILS</span><h2>{user.displayName || 'Your profile'}</h2><p>{user.email}</p>{user.phoneNumber && <p>{user.phoneNumber}</p>}{adminAccessError && <p className="form-error" role="alert">{adminAccessError}</p>}</div>
        <div className="account-profile-actions">
          {user.email?.toLowerCase() === ADMIN_EMAIL && <button className="button button-burgundy admin-account-button" onClick={() => void openAdminPortal()} disabled={checkingAdminAccess}>{checkingAdminAccess ? 'Verifying access…' : 'Admin portal'} <ShieldCheck size={15} /></button>}
          <button className="text-link" onClick={() => void logout()}>Sign out <ArrowUpRight size={15} /></button>
        </div>
      </div>
    </main>
    <Footer /><SupportChat user={user} onSignIn={() => setAuthOpen(true)} />
  </div>
}

function SupportChat({ user, onSignIn }: { user: User | null; onSignIn: () => void }) {
  const [open, setOpen] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null)
  const suppressClickRef = useRef(false)
  const [launcherPosition, setLauncherPosition] = useState<{ x: number; y: number } | null>(null)
  const clampLauncherPosition = (x: number, y: number) => {
    const bounds = launcherRef.current?.getBoundingClientRect()
    const width = bounds?.width || 126
    const height = bounds?.height || 52
    return {
      x: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - height - 8)),
    }
  }
  useEffect(() => {
    let restored: { x: number; y: number } | null = null
    try {
      const saved = window.localStorage.getItem('lux-escape-chat-position')
      if (saved) {
        const parsed: unknown = JSON.parse(saved)
        if (typeof parsed === 'object' && parsed !== null && 'x' in parsed && 'y' in parsed
          && typeof parsed.x === 'number' && Number.isFinite(parsed.x)
          && typeof parsed.y === 'number' && Number.isFinite(parsed.y)) {
          restored = { x: parsed.x, y: parsed.y }
        }
      }
    } catch (reason) {
      console.warn('Unable to restore the support button position:', reason)
    }
    const defaultBounds = launcherRef.current?.getBoundingClientRect()
    const initial = restored
      ? clampLauncherPosition(restored.x, restored.y)
      : clampLauncherPosition(defaultBounds?.left ?? window.innerWidth - 150, defaultBounds?.top ?? window.innerHeight - 75)
    setLauncherPosition(initial)
    const onResize = () => setLauncherPosition((position) => position ? clampLauncherPosition(position.x, position.y) : position)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const moveLauncher = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
    if (distance > 5) drag.moved = true
    if (!drag.moved) return
    setLauncherPosition(clampLauncherPosition(drag.originX + event.clientX - drag.startX, drag.originY + event.clientY - drag.startY))
  }
  const finishLauncherMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = null
    if (drag.moved) {
      suppressClickRef.current = true
      if (launcherPosition) {
        try {
          window.localStorage.setItem('lux-escape-chat-position', JSON.stringify(launcherPosition))
        } catch (reason) {
          console.warn('Unable to save the support button position:', reason)
        }
      }
      window.setTimeout(() => { suppressClickRef.current = false }, 0)
    }
  }
  useEffect(() => {
    const openChat = () => setOpen(true)
    window.addEventListener('lux-open-support', openChat)
    return () => window.removeEventListener('lux-open-support', openChat)
  }, [])
  useEffect(() => {
    if (!db || !user) { setConversationId(null); setMessages([]); return }
    return onSnapshot(query(collection(db, 'conversations'), where('userId', '==', user.uid)), (snapshot) => {
      const conversation = snapshot.docs[0]
      setConversationId(conversation?.id || null)
    }, (reason) => { console.error('Unable to load support conversation:', reason); setError('We couldn’t load your messages. Please try again later.') })
  }, [user])
  useEffect(() => {
    if (!db || !conversationId) { setMessages([]); return }
    return onSnapshot(query(collection(db, 'conversations', conversationId, 'messages'), orderBy('createdAt', 'asc')), (snapshot) => {
      setMessages(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ChatMessage)))
      window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 40)
    }, (reason) => { console.error('Unable to load messages:', reason); setError('We couldn’t load your messages. Please try again later.') })
  }, [conversationId, bottomRef])
  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user) { onSignIn(); return }
    if (!db || !input.trim()) return
    setSending(true); setError('')
    try {
      let id = conversationId
      if (!id) {
        const ref = await addDoc(collection(db, 'conversations'), { userId: user.uid, userName: user.displayName || '', userEmail: user.email || '', status: 'open', unreadForAdmin: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
        id = ref.id; setConversationId(id)
      }
      await addDoc(collection(db, 'conversations', id, 'messages'), { senderId: user.uid, text: input.trim(), type: 'text', read: false, createdAt: serverTimestamp() })
      await setDoc(doc(db, 'conversations', id), { lastMessage: input.trim(), updatedAt: serverTimestamp(), unreadForAdmin: 1 }, { merge: true })
      setInput('')
    } catch (reason) { setError(firebaseMessage(reason)) } finally { setSending(false) }
  }
  return <div className="support-widget">
    <AnimatePresence>{open && <motion.div className="chat-panel" initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }} transition={{ duration: 0.22 }}>
      <div className="chat-header"><div className="chat-avatar">LE</div><div><strong>A little help?</strong><span><i /> LUX ESCAPE · usually replies soon</span></div><button onClick={() => setOpen(false)} aria-label="Close chat"><X size={18} /></button></div>
      <div className="chat-messages">
        <div className="chat-welcome"><span>WELCOME TO LUX ESCAPE</span><p>Have a question about an escape? Our team is here to help.</p></div>
        {!user && <div className="chat-signin-notice">Sign in to start a conversation and keep your messages safe.</div>}
        {messages.map((message) => <div key={message.id} className={`chat-bubble ${message.senderId === user?.uid ? 'chat-mine' : 'chat-theirs'}`}><p>{message.text}</p><time>{message.createdAt?.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) || 'Sending…'}</time></div>)}
        {error && <p className="chat-error">{error}</p>}<div ref={bottomRef} />
      </div>
      <form className="chat-compose" onSubmit={send}><input aria-label="Your message" value={input} onChange={(event) => setInput(event.target.value)} placeholder={user ? 'Write a message…' : 'Sign in to send a message'} disabled={sending} /><button type="submit" aria-label="Send message" disabled={sending || !input.trim()}><ArrowUpRight size={18} /></button></form>
      <div className="chat-privacy"><ShieldCheck size={12} /> Your conversation stays private and saved to your account.</div>
    </motion.div>}</AnimatePresence>
    <button ref={launcherRef} className={`chat-launcher ${open ? 'chat-launcher-open' : ''}`} style={launcherPosition ? { left: launcherPosition.x, top: launcherPosition.y, right: 'auto', bottom: 'auto' } : undefined}
      onPointerDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect()
        dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: bounds.left, originY: bounds.top, moved: false }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={moveLauncher}
      onPointerUp={finishLauncherMove}
      onPointerCancel={finishLauncherMove}
      onClick={() => {
        if (suppressClickRef.current) return
        if (user || !open) setOpen(!open)
        else onSignIn()
      }}
      aria-label={open ? 'Close support chat' : 'Open support chat'}
      aria-description="Drag to move this button. Activate to open support chat."
      title="Drag to move">
      {open ? <X size={21} /> : <><MessageCircle size={21} /><span>Let’s talk</span></>}
    </button>
  </div>
}

function AdminMediaPanel({ siteMedia, galleryItems, galleryAlbums, events, onReplaceEventImage, onResetEventImage, onError }: {
  siteMedia: Record<string, SiteMedia>
  galleryItems: GalleryMedia[]
  galleryAlbums: GalleryAlbum[]
  events: Trip[]
  onReplaceEventImage: (event: Trip, file: File, fit: ImageFit) => Promise<boolean | string>
  onResetEventImage: (event: Trip) => Promise<void>
  onError: (message: string) => void
}) {
  const [busySlot, setBusySlot] = useState('')
  const [galleryBusy, setGalleryBusy] = useState(false)
  const [galleryTitle, setGalleryTitle] = useState('')
  const [galleryCaption, setGalleryCaption] = useState('')
  const [galleryMediaFile, setGalleryMediaFile] = useState<File | null>(null)
  const [galleryImageFit, setGalleryImageFit] = useState<ImageFit | null>(null)
  const [selectedAlbumId, setSelectedAlbumId] = useState('')
  const [albumTitle, setAlbumTitle] = useState('')
  const [albumLocation, setAlbumLocation] = useState('')
  const [albumDescription, setAlbumDescription] = useState('')
  const [albumCoverFile, setAlbumCoverFile] = useState<File | null>(null)
  const [albumCoverFit, setAlbumCoverFit] = useState<ImageFit | null>(null)
  const [albumCoverPreview, setAlbumCoverPreview] = useState('')
  const [albumBusy, setAlbumBusy] = useState(false)
  const [cropRequest, setCropRequest] = useState<{ file: File; title: string; aspectRatio: number; mobileAspectRatio?: number; onSave: (fit: ImageFit) => Promise<boolean | string> } | null>(null)
  const [siteMediaFeedback, setSiteMediaFeedback] = useState<{ message: string; error: boolean } | null>(null)

  useEffect(() => {
    if (!albumCoverFile) { setAlbumCoverPreview(''); return }
    const url = URL.createObjectURL(albumCoverFile)
    setAlbumCoverPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [albumCoverFile])

  const openImagePositioner = (file: File, title: string, aspectRatio: number, onSave: (fit: ImageFit) => Promise<boolean | string>, mobileAspectRatio?: number) => {
    if (!file.type.startsWith('image/')) return setSiteMediaFeedback({ message: 'Choose an image file.', error: true })
    if (file.size > MAX_MEDIA_SIZE) return setSiteMediaFeedback({ message: 'Choose a file smaller than 20 MB.', error: true })
    setCropRequest({ file, title, aspectRatio, mobileAspectRatio, onSave })
  }

  const replaceSiteImage = async (slotId: string, file: File, fit: ImageFit) => {
    if (!db) { setSiteMediaFeedback({ message: 'Firestore is not configured.', error: true }); return 'Firestore is not configured.' }
    setBusySlot(slotId); setSiteMediaFeedback({ message: 'Uploading image to Cloudinary…', error: false }); onError('')
    let uploaded: { url: string; cloudinaryPublicId: string } | null = null
    try {
      uploaded = await uploadPublicMedia(file)
      await setDoc(doc(db, 'websiteContent', slotId), { title: SITE_IMAGE_SLOTS.find((slot) => slot.id === slotId)?.title || slotId, url: uploaded.url, cloudinaryPublicId: uploaded.cloudinaryPublicId, ...fit, published: true, updatedAt: serverTimestamp() }, { merge: true })
      setSiteMediaFeedback({ message: 'Image uploaded and saved. The website preview should update shortly.', error: false })
      return true
    } catch (reason) {
      const message = uploaded ? `${firebaseMessage(reason)} The upload succeeded, but the website image was not saved; remove the unused asset from Cloudinary.` : uploadErrorMessage(reason)
      setSiteMediaFeedback({ message, error: true })
      onError(message)
      return message
    }
    finally { setBusySlot('') }
  }

  const resetSiteImage = async (slotId: string) => {
    if (!db) return setSiteMediaFeedback({ message: 'Firestore is not configured.', error: true })
    setBusySlot(slotId); setSiteMediaFeedback({ message: 'Resetting image…', error: false }); onError('')
    try {
      if ((slotId.startsWith('hero-') || slotId.startsWith('experience-')) && siteMedia[slotId]) {
        await updateDoc(doc(db, 'websiteContent', slotId), {
          url: deleteField(),
          cloudinaryPublicId: deleteField(),
          imagePositionX: deleteField(),
          imagePositionY: deleteField(),
          imageZoom: deleteField(),
          published: true,
          updatedAt: serverTimestamp(),
        })
      } else {
        await deleteDoc(doc(db, 'websiteContent', slotId))
      }
      setSiteMediaFeedback({ message: 'Image reset. The original website image is restored.', error: false })
    } catch (reason) {
      const message = firebaseMessage(reason)
      setSiteMediaFeedback({ message, error: true })
      onError(message)
    }
    finally { setBusySlot('') }
  }

  const saveHeroCopy = async (slotId: string, event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!db) return setSiteMediaFeedback({ message: 'Firestore is not configured.', error: true })
    const form = new FormData(event.currentTarget)
    const heroEyebrow = String(form.get('heroEyebrow') || '').trim()
    const heroHeadline = String(form.get('heroHeadline') || '').trim()
    const heroHeadlineEmphasis = String(form.get('heroHeadlineEmphasis') || '').trim()
    const heroDescription = String(form.get('heroDescription') || '').trim()
    if (!heroEyebrow || !heroHeadline || !heroHeadlineEmphasis || !heroDescription) {
      return setSiteMediaFeedback({ message: 'Complete all hero text fields before saving.', error: true })
    }
    setBusySlot(slotId); setSiteMediaFeedback({ message: 'Saving hero text…', error: false }); onError('')
    try {
      await setDoc(doc(db, 'websiteContent', slotId), {
        title: SITE_IMAGE_SLOTS.find((slot) => slot.id === slotId)?.title || slotId,
        heroEyebrow,
        heroHeadline,
        heroHeadlineEmphasis,
        heroDescription,
        published: true,
        updatedAt: serverTimestamp(),
      }, { merge: true })
      setSiteMediaFeedback({ message: 'Hero text saved and published.', error: false })
    } catch (reason) {
      const message = firebaseMessage(reason)
      setSiteMediaFeedback({ message, error: true })
      onError(message)
    } finally { setBusySlot('') }
  }

  const saveExperienceCopy = async (slotId: string, event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!db) return setSiteMediaFeedback({ message: 'Firestore is not configured.', error: true })
    const form = new FormData(event.currentTarget)
    const experienceTitle = String(form.get('experienceTitle') || '').trim()
    const experienceKind = String(form.get('experienceKind') || '').trim()
    const experiencePlace = String(form.get('experiencePlace') || '').trim()
    if (!experienceTitle || !experienceKind || !experiencePlace) {
      return setSiteMediaFeedback({ message: 'Complete all experience card text fields before saving.', error: true })
    }
    setBusySlot(slotId); setSiteMediaFeedback({ message: 'Saving experience card text…', error: false }); onError('')
    try {
      await setDoc(doc(db, 'websiteContent', slotId), {
        title: SITE_IMAGE_SLOTS.find((slot) => slot.id === slotId)?.title || slotId,
        experienceTitle,
        experienceKind,
        experiencePlace,
        published: true,
        updatedAt: serverTimestamp(),
      }, { merge: true })
      setSiteMediaFeedback({ message: 'Experience card text saved and published.', error: false })
    } catch (reason) {
      const message = firebaseMessage(reason)
      setSiteMediaFeedback({ message, error: true })
      onError(message)
    } finally { setBusySlot('') }
  }

  const addGalleryMedia = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const file = galleryMediaFile
    if (!file || file.size === 0) return onError('Choose a photo or video to add to Memories.')
    if (!selectedAlbumId) return onError('Choose the event or trip playlist for this memory.')
    if (!db) return onError('Firestore is not configured.')
    setGalleryBusy(true); onError('')
    let uploaded: { url: string; cloudinaryPublicId: string } | null = null
    try {
      uploaded = await uploadPublicMedia(file)
      await addDoc(collection(db, 'galleryMedia'), {
        albumId: selectedAlbumId,
        title: galleryTitle.trim(),
        caption: galleryCaption.trim(),
        type: file.type.startsWith('video/') ? 'video' : 'image',
        url: uploaded.url,
        cloudinaryPublicId: uploaded.cloudinaryPublicId,
        ...(galleryImageFit || {}),
        published: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setGalleryTitle(''); setGalleryCaption(''); setGalleryMediaFile(null); setGalleryImageFit(null); form.reset()
    } catch (reason) {
      onError(uploaded ? `${firebaseMessage(reason)} The media upload succeeded, but its gallery record was not saved; remove the unused asset from Cloudinary.` : firebaseMessage(reason))
    } finally { setGalleryBusy(false) }
  }

  const createGalleryAlbum = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    if (!db) return onError('Firestore is not configured.')
    if (!albumCoverFile || !albumCoverFit) return onError('Choose a preview image and set its framing before creating the playlist.')
    setAlbumBusy(true); onError('')
    let uploaded: { url: string; cloudinaryPublicId: string } | null = null
    try {
      uploaded = await uploadPublicMedia(albumCoverFile)
      const created = await addDoc(collection(db, 'galleryAlbums'), {
        title: albumTitle.trim(),
        location: albumLocation.trim(),
        description: albumDescription.trim(),
        coverUrl: uploaded.url,
        coverPublicId: uploaded.cloudinaryPublicId,
        ...albumCoverFit,
        published: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setSelectedAlbumId(created.id)
      setAlbumTitle(''); setAlbumLocation(''); setAlbumDescription(''); setAlbumCoverFile(null); setAlbumCoverFit(null)
      form.reset()
    } catch (reason) {
      onError(uploaded ? `${firebaseMessage(reason)} The preview image uploaded, but the playlist was not saved; remove the unused asset from Cloudinary.` : uploadErrorMessage(reason))
    } finally { setAlbumBusy(false) }
  }

  const setGalleryAlbumPublished = async (album: GalleryAlbum) => {
    if (!db) return onError('Firestore is not configured.')
    onError('')
    try { await updateDoc(doc(db, 'galleryAlbums', album.id), { published: !album.published, updatedAt: serverTimestamp() }) }
    catch (reason) { onError(firebaseMessage(reason)) }
  }

  const assignGalleryMedia = async (item: GalleryMedia, albumId: string) => {
    if (!db || !albumId) return
    onError('')
    try { await updateDoc(doc(db, 'galleryMedia', item.id), { albumId, updatedAt: serverTimestamp() }) }
    catch (reason) { onError(firebaseMessage(reason)) }
  }

  const setGalleryPublished = async (item: GalleryMedia) => {
    if (!db) return onError('Firestore is not configured.')
    onError('')
    try { await updateDoc(doc(db, 'galleryMedia', item.id), { published: !item.published, updatedAt: serverTimestamp() }) }
    catch (reason) { onError(firebaseMessage(reason)) }
  }

  const removeGalleryItem = async (item: GalleryMedia) => {
    if (!db || !window.confirm(`Remove "${item.title}" from the Memories gallery?`)) return
    onError('')
    try {
      await deleteDoc(doc(db, 'galleryMedia', item.id))
    } catch (reason) { onError(firebaseMessage(reason)) }
  }

  return <>
    <section className="admin-panel" id="admin-site-media">
      <div className="admin-panel-head"><div><span className="eyebrow">KEEP YOUR WEBSITE FRESH</span><h2>Website images</h2></div></div>
      <p className="admin-panel-intro">Choose an image to preview its framing before uploading. Drag the preview or adjust zoom and position controls; the image’s framing is saved with it. Reset a slot to restore its original image. Files must be smaller than 20 MB. Replaced and reset files remain in Cloudinary; delete unused assets from the Cloudinary Media Library.</p>
      {siteMediaFeedback && <p className={siteMediaFeedback.error ? 'media-feedback media-feedback-error' : 'media-feedback'} role={siteMediaFeedback.error ? 'alert' : 'status'}>{siteMediaFeedback.message}</p>}
      <div className="site-media-grid">{SITE_IMAGE_SLOTS.map((slot) => {
        const item = siteMedia[slot.id]
        const isHeroSlot = slot.id.startsWith('hero-')
        const isExperienceSlot = slot.id.startsWith('experience-')
        const defaultHero = photos.hero[Number(slot.id.slice(-1)) - 1] || photos.hero[0]
        const defaultExperience = photos.experience[Number(slot.id.slice(-1)) - 1] || photos.experience[0]
        return <article className={`site-media-card ${slot.id === 'brand-logo' ? 'site-media-logo' : ''}`} key={slot.id}>
          <img src={item?.url || defaultSiteImage(slot.id)} alt="" style={imageFitStyle(item)} />
          <div className="site-media-details"><strong>{slot.title}</strong><span>{slot.placement}</span></div>
          <div className="site-media-actions">
            <label className="media-action">{busySlot === slot.id ? 'Uploading…' : 'Upload new image'}<input type="file" accept="image/*" disabled={busySlot !== ''} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) { if (slot.id === 'brand-logo') void replaceSiteImage(slot.id, file, { imagePositionX: 50, imagePositionY: 50, imageZoom: 1 }); else openImagePositioner(file, slot.title, siteImageAspectRatio(slot.id), (fit) => replaceSiteImage(slot.id, file, fit), siteImageMobileAspectRatio(slot.id)) } event.currentTarget.value = '' }} /></label>
            {item && <button className="media-action" disabled={busySlot !== ''} onClick={() => void resetSiteImage(slot.id)}>Reset image</button>}
          </div>
          {isHeroSlot && <form key={JSON.stringify([slot.id, item?.heroEyebrow, item?.heroHeadline, item?.heroHeadlineEmphasis, item?.heroDescription])} className="hero-copy-form" onSubmit={(event) => void saveHeroCopy(slot.id, event)}>
            <span className="hero-copy-label">SLIDE TEXT</span>
            <label>Eyebrow<input name="heroEyebrow" defaultValue={item?.heroEyebrow || defaultHero.place} maxLength={60} required /></label>
            <label>Headline<input name="heroHeadline" defaultValue={item?.heroHeadline || 'A little further.'} maxLength={70} required /></label>
            <label>Emphasized headline<input name="heroHeadlineEmphasis" defaultValue={item?.heroHeadlineEmphasis || 'A lot more alive.'} maxLength={70} required /></label>
            <label>Description<textarea name="heroDescription" defaultValue={item?.heroDescription || 'Thoughtfully curated escapes for those who want to feel a place, not just see it.'} maxLength={220} rows={3} required /></label>
            <button className="media-action hero-copy-save" type="submit" disabled={busySlot !== ''}>{busySlot === slot.id ? 'Saving…' : 'Save slide text'}</button>
          </form>}
          {isExperienceSlot && <form key={JSON.stringify([slot.id, item?.experienceTitle, item?.experienceKind, item?.experiencePlace])} className="hero-copy-form" onSubmit={(event) => void saveExperienceCopy(slot.id, event)}>
            <span className="hero-copy-label">EXPERIENCE CARD TEXT</span>
            <label>Category / kind<input name="experienceKind" defaultValue={item?.experienceKind || defaultExperience.kind} maxLength={50} required /></label>
            <label>Card title<input name="experienceTitle" defaultValue={item?.experienceTitle || defaultExperience.title} maxLength={70} required /></label>
            <label>Location / place<input name="experiencePlace" defaultValue={item?.experiencePlace || defaultExperience.place} maxLength={60} required /></label>
            <button className="media-action hero-copy-save" type="submit" disabled={busySlot !== ''}>{busySlot === slot.id ? 'Saving…' : 'Save card text'}</button>
          </form>}
        </article>
      })}</div>
      <div className="admin-event-covers">
        <h3>Event and trip cover photos</h3>
        {events.length === 0 ? <p>No events or trips yet. Add one above to manage its cover photo here.</p> : events.map((trip) => <div className="event-cover-row" key={trip.id}>
          <img src={trip.image || photos.experience[0].image} alt="" style={imageFitStyle(trip)} />
          <div><strong>{trip.title}</strong><span>{trip.destination}</span></div>
          <label className="media-action">Change cover<input type="file" accept="image/*" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) openImagePositioner(file, `${trip.title} cover`, 1.5, (fit) => onReplaceEventImage(trip, file, fit), 0.8); event.currentTarget.value = '' }} /></label>
          {(trip.cloudinaryPublicId || trip.image !== (trip.originalImage || photos.experience[0].image)) && <button className="media-action" onClick={() => void onResetEventImage(trip)}>Reset image</button>}
        </div>)}
      </div>
    </section>
    <section className="admin-panel" id="admin-gallery">
      <div className="admin-panel-head"><div><span className="eyebrow">REAL MOMENTS, SHARED WITH CARE</span><h2>Memories gallery</h2></div></div>
      <p className="admin-panel-intro">Create an event or trip playlist with a cover image, then add its photos and videos below. Published playlists and their media appear on the public Memories page. Files must be smaller than 20 MB; Cloudinary assets must be deleted separately when no longer needed.</p>
      <form className="gallery-upload-form" onSubmit={addGalleryMedia}>
        <label>Event or trip playlist<select value={selectedAlbumId} onChange={(event) => setSelectedAlbumId(event.target.value)} required disabled={galleryAlbums.filter((album) => album.published).length === 0}><option value="">Choose a playlist</option>{galleryAlbums.filter((album) => album.published).map((album) => <option value={album.id} key={album.id}>{album.title}</option>)}</select></label>
        <label>Memory title<input value={galleryTitle} onChange={(event) => setGalleryTitle(event.target.value)} required maxLength={80} placeholder="e.g. Our weekend in Cape Coast" /></label>
        <label>Caption (optional)<input value={galleryCaption} onChange={(event) => setGalleryCaption(event.target.value)} maxLength={180} placeholder="A short note about this moment" /></label>
        <label className="gallery-file-input">Photo or video<input type="file" name="galleryFile" accept="image/*,video/*" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (!file) return; if (file.type.startsWith('image/')) { setGalleryMediaFile(null); setGalleryImageFit(null); openImagePositioner(file, 'Memories gallery photo', 345 / 325, async (fit) => { setGalleryMediaFile(file); setGalleryImageFit(fit); return true }, 1) } else { setGalleryMediaFile(file); setGalleryImageFit(null) } event.currentTarget.value = '' }} /></label>
        {galleryMediaFile && <span className="gallery-selected-file">{galleryMediaFile.name}{galleryImageFit && ' · framing ready'}</span>}
        <button className="button button-burgundy" disabled={galleryBusy}>{galleryBusy ? 'Uploading…' : 'Add to Memories'} <Plus size={15} /></button>
      </form>
      <form className="gallery-playlist-form" onSubmit={createGalleryAlbum}>
        <div className="gallery-playlist-heading"><span className="eyebrow">ORGANIZE YOUR STORIES</span><h3>Create an event or trip playlist</h3><p>Each playlist gets its own cover and a page for all the photos and videos from that escape.</p></div>
        <label>Event or trip name<input value={albumTitle} onChange={(event) => setAlbumTitle(event.target.value)} maxLength={80} required placeholder="e.g. Cape Coast Weekend Escape" /></label>
        <label>Destination / location<input value={albumLocation} onChange={(event) => setAlbumLocation(event.target.value)} maxLength={60} placeholder="e.g. Cape Coast, Central Region" /></label>
        <label>Description (optional)<textarea value={albumDescription} onChange={(event) => setAlbumDescription(event.target.value)} maxLength={180} rows={2} placeholder="A short introduction to this trip" /></label>
        <label className="gallery-playlist-cover-input">Playlist preview image<input type="file" accept="image/*" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) { setAlbumCoverFile(null); setAlbumCoverFit(null); openImagePositioner(file, 'Playlist preview image', 1.5, async (fit) => { setAlbumCoverFile(file); setAlbumCoverFit(fit); return true }, 0.9) } event.currentTarget.value = '' }} /></label>
        {albumCoverFile && <div className="gallery-playlist-cover-selected"><img src={albumCoverPreview} alt="" style={imageFitStyle(albumCoverFit || undefined)} /><span>{albumCoverFile.name} · preview ready</span><button type="button" className="media-action" onClick={() => openImagePositioner(albumCoverFile, 'Playlist preview image', 1.5, async (fit) => { setAlbumCoverFit(fit); return true }, 0.9)}>Adjust preview</button><button type="button" className="media-action" onClick={() => { setAlbumCoverFile(null); setAlbumCoverFit(null) }}>Remove</button></div>}
        <button className="button button-burgundy" type="submit" disabled={albumBusy || !albumCoverFile || !albumCoverFit}>{albumBusy ? 'Creating playlist…' : 'Create playlist'} <Plus size={15} /></button>
      </form>
      <div className="gallery-playlist-admin-grid">{galleryAlbums.length === 0 ? <div className="admin-empty">No playlists yet. Create a playlist above before adding new memories.</div> : galleryAlbums.map((album) => {
        const cover = album.coverUrl || galleryItems.find((item) => item.albumId === album.id)?.url || ''
        return <article className="gallery-playlist-admin-card" key={album.id}>
          {cover && <img src={cover} alt="" style={imageFitStyle(album)} />}
          <div><strong>{album.title}</strong><span>{galleryItems.filter((item) => item.albumId === album.id).length} memories · {album.published ? 'Visible on website' : 'Hidden from website'}</span>{album.location && <small>{album.location}</small>}</div>
          <button className="media-action" onClick={() => void setGalleryAlbumPublished(album)}>{album.published ? 'Hide playlist' : 'Publish playlist'}</button>
        </article>
      })}</div>
      <div className="gallery-admin-grid">{galleryItems.length === 0 ? <div className="admin-empty">No memories added yet. Create a playlist and upload its photos or videos above.</div> : galleryItems.map((item) => <article className="gallery-admin-card" key={item.id}>
        {item.type === 'video' ? <video src={item.url} controls preload="metadata" /> : <img src={item.url} alt={item.title} style={imageFitStyle(item)} />}
        <div><strong>{item.title}</strong>{item.caption && <p>{item.caption}</p>}<span>{item.type} · {item.published ? 'Visible on website' : 'Hidden from website'}</span>
          <select aria-label={`Playlist for ${item.title}`} value={item.albumId || ''} onChange={(event) => void assignGalleryMedia(item, event.target.value)}><option value="" disabled>{item.albumId ? 'Choose playlist' : 'Unassigned legacy memory'}</option>{galleryAlbums.map((album) => <option value={album.id} key={album.id}>{album.title}</option>)}</select>
        </div>
        <div className="gallery-admin-actions"><button className="media-action" onClick={() => void setGalleryPublished(item)}>{item.published ? 'Hide' : 'Publish'}</button><button className="media-action media-action-danger" onClick={() => void removeGalleryItem(item)}>Remove</button></div>
      </article>)}</div>
    </section>
    {cropRequest && <ImagePositionDialog key={cropRequest.file.name + cropRequest.file.lastModified} file={cropRequest.file} title={cropRequest.title} aspectRatio={cropRequest.aspectRatio} mobileAspectRatio={cropRequest.mobileAspectRatio} onClose={() => setCropRequest(null)} onSave={cropRequest.onSave} />}
  </>
}

function AdminPage({ user, authReady }: { user: User | null; authReady: boolean }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)
  const [trips, setTrips] = useState<Trip[]>([])
  const [siteMedia, setSiteMedia] = useState<Record<string, SiteMedia>>({})
  const [galleryItems, setGalleryItems] = useState<GalleryMedia[]>([])
  const [galleryAlbums, setGalleryAlbums] = useState<GalleryAlbum[]>([])
  const [conversations, setConversations] = useState<Record<string, unknown>[]>([])
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [reply, setReply] = useState('')
  const [adminError, setAdminError] = useState('')
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [createTripImage, setCreateTripImage] = useState<{ file: File; fit: ImageFit } | null>(null)
  const [createTripCropFile, setCreateTripCropFile] = useState<File | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  useEffect(() => {
    if (!user) { setIsAdmin(false); setChecking(false); return }
    setChecking(true)
    user.reload().then(() => user.getIdTokenResult(true)).then((token) => setIsAdmin(user.email?.toLowerCase() === ADMIN_EMAIL && token.claims.email_verified === true)).catch((reason) => { console.error('Unable to verify admin access:', reason); setAdminError('We couldn’t verify your access. Please try again.') }).finally(() => setChecking(false))
  }, [user])
  useEffect(() => {
    if (!db || !isAdmin) return
    const stopTrips = onSnapshot(query(collection(db, 'events'), orderBy('startDate', 'asc')), (snap) => setTrips(snap.docs.map((item) => ({ id: item.id, ...item.data() } as Trip))), (reason) => { console.error('Unable to load events:', reason); setAdminError('Unable to load events.') })
    const stopChats = onSnapshot(query(collection(db, 'conversations'), orderBy('updatedAt', 'desc')), (snap) => setConversations(snap.docs.map((item) => ({ id: item.id, ...item.data() }))), (reason) => { console.error('Unable to load conversations:', reason); setAdminError('Unable to load conversations.') })
    const stopSiteMedia = onSnapshot(collection(db, 'websiteContent'), (snap) => setSiteMedia(Object.fromEntries(snap.docs.map((item) => [item.id, { id: item.id, ...item.data() } as SiteMedia]))), (reason) => { console.error('Unable to load website media in admin:', reason); setAdminError('Unable to load website media.') })
    const stopGallery = onSnapshot(collection(db, 'galleryMedia'), (snap) => setGalleryItems(snap.docs.map((item) => ({ id: item.id, ...item.data() } as GalleryMedia)).sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))), (reason) => { console.error('Unable to load gallery media in admin:', reason); setAdminError('Unable to load memories gallery.') })
    const stopGalleryAlbums = onSnapshot(collection(db, 'galleryAlbums'), (snap) => setGalleryAlbums(snap.docs.map((item) => ({ id: item.id, ...item.data() } as GalleryAlbum)).sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))), (reason) => { console.error('Unable to load memories playlists in admin:', reason); setAdminError('Unable to load memories playlists.') })
    return () => { stopTrips(); stopChats(); stopSiteMedia(); stopGallery(); stopGalleryAlbums() }
  }, [isAdmin])
  useEffect(() => {
    if (!db || !isAdmin || !activeConversation) { setChatMessages([]); return }
    return onSnapshot(query(collection(db, 'conversations', activeConversation, 'messages'), orderBy('createdAt', 'asc')), (snap) => setChatMessages(snap.docs.map((item) => ({ id: item.id, ...item.data() } as ChatMessage))), (reason) => { console.error('Unable to load admin messages:', reason); setAdminError('Unable to load this conversation.') })
  }, [activeConversation, isAdmin])
  const createTrip = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!db) return
    setCreating(true); setAdminError('')
    const data = new FormData(event.currentTarget)
    let uploaded: { url: string; cloudinaryPublicId: string } | null = null
    try {
      if (createTripImage?.file) {
        uploaded = await uploadPublicMedia(createTripImage.file)
      }
      const image = uploaded?.url || String(data.get('image') || '')
      if (!image) throw new Error('Add a cover image URL or upload a cover image.')
      await addDoc(collection(db, 'events'), { title: String(data.get('title')), destination: String(data.get('destination')), region: String(data.get('region')), description: String(data.get('description')), image, originalImage: image, cloudinaryPublicId: uploaded?.cloudinaryPublicId || '', ...(createTripImage?.fit || {}), startDate: String(data.get('startDate')), endDate: String(data.get('endDate')), capacity: Number(data.get('capacity')), reservedSeats: 0, price: Number(data.get('price')), published: data.get('published') === 'on', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      setShowCreate(false)
      setCreateTripImage(null)
    } catch (reason) {
      setAdminError(uploaded ? `${firebaseMessage(reason)} The cover upload succeeded, but the event was not saved; remove the unused asset from Cloudinary.` : firebaseMessage(reason))
    } finally { setCreating(false) }
  }
  const replaceEventImage = async (trip: Trip, file: File, fit: ImageFit) => {
    if (!db) { setAdminError('Firestore is not configured.'); return 'Firestore is not configured.' }
    if (!file.type.startsWith('image/')) { setAdminError('Choose an image file for the event cover.'); return 'Choose an image file for the event cover.' }
    setAdminError('')
    let uploaded: { url: string; cloudinaryPublicId: string } | null = null
    try {
      uploaded = await uploadPublicMedia(file)
      await updateDoc(doc(db, 'events', trip.id), { image: uploaded.url, cloudinaryPublicId: uploaded.cloudinaryPublicId, ...fit, updatedAt: serverTimestamp() })
      return true
    } catch (reason) {
      const message = uploaded ? `${firebaseMessage(reason)} The upload succeeded, but the event cover was not saved; remove the unused asset from Cloudinary.` : firebaseMessage(reason)
      setAdminError(message)
      return message
    }
  }
  const resetEventImage = async (trip: Trip) => {
    if (!db) return setAdminError('Firestore is not configured.')
    setAdminError('')
    try {
      await updateDoc(doc(db, 'events', trip.id), { image: trip.originalImage || photos.experience[0].image, cloudinaryPublicId: '', imagePositionX: deleteField(), imagePositionY: deleteField(), imageZoom: deleteField(), updatedAt: serverTimestamp() })
    } catch (reason) { setAdminError(firebaseMessage(reason)) }
  }
  const closeCreateTrip = () => {
    setShowCreate(false)
    setCreateTripImage(null)
    setCreateTripCropFile(null)
  }
  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!db || !user || !activeConversation || !reply.trim()) return
    try {
      await addDoc(collection(db, 'conversations', activeConversation, 'messages'), { senderId: user.uid, text: reply.trim(), type: 'text', read: false, createdAt: serverTimestamp() })
      await setDoc(doc(db, 'conversations', activeConversation), { lastMessage: reply.trim(), updatedAt: serverTimestamp(), unreadForAdmin: 0 }, { merge: true })
      setReply('')
    } catch (reason) { setAdminError(firebaseMessage(reason)) }
  }
  return <div className="admin-app">
    <aside className="admin-sidebar"><Brand inverse /><span className="admin-label">WORKSPACE</span><a className="admin-nav-active" href="#overview"><Compass size={17} /> Overview</a><a href="#admin-trips"><CalendarDays size={17} /> Events & trips</a><a href="#admin-site-media"><Sparkles size={17} /> Website images</a><a href="#admin-gallery"><MoveUpRight size={17} /> Memories gallery</a><a href="#admin-inbox"><MessageCircle size={17} /> Guest messages <span>{conversations.length || ''}</span></a><div className="admin-sidebar-bottom"><a href="/"><ArrowLeft size={16} /> View website</a>{user && <button onClick={() => void logout()}>Sign out</button>}</div></aside>
    <main className="admin-main">
      <div className="admin-topbar"><div><span>YOUR WORKSPACE</span><h1>Good things happen here.</h1></div><div className="admin-user"><span>{user?.displayName || user?.email || 'Guest'}</span><div>{user?.displayName?.[0] || 'L'}</div></div></div>
      {!authReady || checking ? <div className="admin-gate">Verifying your access…</div> : !user ? <div className="admin-gate"><ShieldCheck size={32} /><h2>Just for the LUX ESCAPE team.</h2><p>Sign in with an administrator account to continue.</p><button className="button button-burgundy" onClick={() => setAuthOpen(true)}>Sign in <ArrowRight size={15} /></button></div> : !isAdmin ? <div className="admin-gate"><ShieldCheck size={32} /><h2>Administrator access only.</h2><p>This account does not have the required admin role. Ask your Firebase project administrator to grant access.</p><button className="button button-burgundy" onClick={() => void logout()}>Sign out <ArrowRight size={15} /></button></div> : <div className="admin-content" id="overview">
        <div className="admin-welcome"><span className="eyebrow">A GOOD MORNING TO YOU</span><h2>Welcome to your escape desk.</h2><p>A clear view of what’s happening, right now.</p></div>
        {adminError && <p className="form-error">{adminError}</p>}
        <div className="admin-stats"><div><span>PUBLISHED TRIPS</span><strong>{trips.filter((trip) => trip.published).length}</strong><small><CalendarDays size={14} /> Live on your website</small></div><div><span>GUEST CONVERSATIONS</span><strong>{conversations.length}</strong><small><MessageCircle size={14} /> Saved and ready for you</small></div><div><span>PLACES RESERVED</span><strong>{trips.reduce((total, trip) => total + Number(trip.reservedSeats || 0), 0)}</strong><small><Users size={14} /> Across all events</small></div></div>
        <section className="admin-panel" id="admin-trips"><div className="admin-panel-head"><div><span className="eyebrow">KEEP THE GOOD THINGS COMING</span><h2>Upcoming events & trips</h2></div><button className="button button-burgundy" onClick={() => { setAdminError(''); setShowCreate(true) }}><Plus size={16} /> Add an event or trip</button></div>{trips.length === 0 ? <div className="admin-empty">Nothing published yet. Add an event or trip to share it with the world.</div> : <div className="admin-trip-list">{trips.map((trip) => <div className="admin-trip-row" key={trip.id}><img src={trip.image || photos.experience[0].image} alt="" style={imageFitStyle(trip)} /><div><strong>{trip.title}</strong><span>{trip.destination} · {trip.startDate || 'Date TBC'}</span></div><span className={trip.published ? 'published-badge' : 'draft-badge'}>{trip.published ? 'Published' : 'Draft'}</span><span className="admin-capacity">{Math.max(0, trip.capacity - (trip.reservedSeats || 0))} places left</span></div>)}</div>}</section>
        <AdminMediaPanel siteMedia={siteMedia} galleryItems={galleryItems} galleryAlbums={galleryAlbums} events={trips} onReplaceEventImage={replaceEventImage} onResetEventImage={resetEventImage} onError={setAdminError} />
        <section className="admin-panel" id="admin-inbox"><div className="admin-panel-head"><div><span className="eyebrow">REAL PEOPLE. REAL CONVERSATIONS.</span><h2>Guest messages</h2></div></div><div className="admin-inbox-layout"><div className="admin-conversation-list">{conversations.length === 0 ? <p className="admin-empty">No conversations yet.</p> : conversations.map((item) => <button className={`admin-conversation ${activeConversation === item.id ? 'selected' : ''}`} key={String(item.id)} onClick={() => setActiveConversation(String(item.id))}><span className="admin-chat-avatar">{String(item.userName || 'G')[0]}</span><span><strong>{String(item.userName || 'Guest')}</strong><small>{String(item.lastMessage || item.userEmail || 'New conversation')}</small></span></button>)}</div><div className="admin-chat-view">{activeConversation ? <><div className="admin-chat-messages">{chatMessages.map((message) => <div className={`chat-bubble ${message.senderId === user.uid ? 'chat-mine' : 'chat-theirs'}`} key={message.id}><p>{message.text}</p><time>{message.createdAt?.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) || ''}</time></div>)}</div><form className="admin-reply" onSubmit={sendReply}><input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a thoughtful reply…" /><button type="submit" disabled={!reply.trim()}><ArrowUpRight size={17} /></button></form></> : <div className="admin-empty">Choose a conversation to say hello.</div>}</div></div></section>
      </div>}
    </main>
    <AnimatePresence>{authOpen && <AuthModal initialMode="login" returnTo="/admin" adminOnly close={() => setAuthOpen(false)} />}</AnimatePresence>
    <AnimatePresence>{showCreate && <Modal close={closeCreateTrip} className="create-trip-modal"><button className="modal-close" onClick={closeCreateTrip} aria-label="Close"><X size={20} /></button><span className="eyebrow">A NEW STORY BEGINS</span><h2>Add an event or trip</h2>{adminError && <p className="form-error" role="alert">{adminError}</p>}<form className="auth-form" onSubmit={createTrip}><label>Event or trip title<input name="title" required /></label><div className="form-two-col"><label>Destination or venue<input name="destination" required /></label><label>Region<input name="region" required /></label></div><label>Description<textarea name="description" rows={3} required /></label><label>Cover image URL (optional)<input name="image" type="url" placeholder="Use this or upload an image below" /></label><label>Or upload a cover image<input name="imageFile" type="file" accept="image/*" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) { if (!file.type.startsWith('image/')) setAdminError('Choose an image file for the event cover.'); else if (file.size > MAX_MEDIA_SIZE) setAdminError('Choose a file smaller than 20 MB.'); else { setAdminError(''); setCreateTripCropFile(file) } } event.currentTarget.value = '' }} /></label>{createTripImage && <div className="selected-image-framing"><span>{createTripImage.file.name} · framing ready</span><button type="button" className="media-action" onClick={() => setCreateTripCropFile(createTripImage.file)}>Adjust framing</button><button type="button" className="media-action" onClick={() => setCreateTripImage(null)}>Remove</button></div>}<div className="form-two-col"><label>Start date<input name="startDate" type="date" required /></label><label>End date (optional)<input name="endDate" type="date" /></label></div><div className="form-two-col"><label>Price per person or ticket (GH₵)<input name="price" type="number" min="0" required /></label><label>Guest capacity<input name="capacity" type="number" min="1" required /></label></div><label className="checkbox-label"><input name="published" type="checkbox" /> Publish on the website</label><button className="button button-burgundy auth-submit" disabled={creating}>{creating ? 'Saving…' : 'Save event or trip'} <ArrowRight size={16} /></button></form></Modal>}</AnimatePresence>
    {createTripCropFile && <ImagePositionDialog key={createTripCropFile.name + createTripCropFile.lastModified} file={createTripCropFile} title="Event or trip cover" aspectRatio={1.5} mobileAspectRatio={0.8} onClose={() => setCreateTripCropFile(null)} onSave={async (fit) => { setCreateTripImage({ file: createTripCropFile, fit }); return true }} />}
  </div>
}

function firebaseMessage(reason: unknown) {
  if (reason instanceof Error) {
    const messages: Record<string, string> = {
      'auth/email-already-in-use': 'There is already an account with this email. Try signing in instead.',
      'auth/invalid-credential': 'That email and password combination didn’t work. Please try again.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/weak-password': 'Please choose a stronger password.',
      'auth/popup-closed-by-user': 'The sign-in window was closed before finishing.',
      'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
      'permission-denied': 'Firestore denied this change. Publish the updated firestore.rules and confirm you are signed in with the verified authorized admin account.',
    }
    const code = (reason as Error & { code?: string }).code
    return (code && messages[code]) || reason.message
  }
  return 'Something went wrong. Please try again.'
}

export default App
