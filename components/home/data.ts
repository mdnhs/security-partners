export const contact = {
  phone24h: "(085) 8018746",
  phone24hHref: "tel:+353858018746",
  office: "057 8697670",
  officeHref: "tel:+353578697670",
  operationsMobile: "085 859 1299",
  operationsMobileHref: "tel:+353858591299",
  email: "info@securitypartnersltd.com",
  operationsEmail: "operations@securitypartnersltd.com",
  hours: "Monday–Friday, 9am to 6pm",
  addressLine1: "Derryguile, Mountmellick",
  addressLine2: "Co. Laois, R32 YX49",
  mapsHref:
    "https://www.google.com/maps/search/?api=1&query=Security+Partners+Ltd+Derryguile+Mountmellick+Co.+Laois+R32+YX49",
}

export const navLinks = [
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Team", href: "/team" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
]

export const highlights = [
  "Dedicated 24/7 Operations Team for all your security requirements",
  "Midlands location lets us carry out contracts throughout Ireland",
  "Family-run business that has grown by word of mouth",
  "Exceptional training so you get a first class service",
  "24/7 IT service with real-time reporting, clocking and tag point systems",
]

export type Service = {
  slug: string
  title: string
  description: string
  icon: string
  detail: {
    intro: string
    heading: string
    overview: string
    included: string[]
    callout: string
  }
}

// Detail copy for Alarm Responses comes from the design; the other services
// reuse company facts from elsewhere on the site until final copy is supplied.
export const services: Service[] = [
  {
    slug: "alarm-responses",
    title: "Alarm Responses",
    description: "Rapid response to alarm activations, day or night.",
    icon: "/images/service-alarm.png",
    detail: {
      intro:
        "Our highly trained security team will be dispatched to your premises and deal with the situation, day or night.",
      heading: "Fast, professional alarm response",
      overview:
        "Security Partners Ltd specialise in alarm response and key holding services. Our highly trained security team will be dispatched to your premises and deal with the situation, giving you the peace of mind your premises is safe and secure in our hands.",
      included: [
        "Rapid dispatch of trained, uniformed officers to your premises",
        "Key holding, so your site can be accessed and secured without calling you out",
        "A dedicated 24/7 Operations Team on call for every activation",
        "Real-time reporting through our clocking and tag point systems",
        "Coverage across Ireland from our base in the midlands",
      ],
      callout: "Alarm activated? Call our 24 Hour Number",
    },
  },
  {
    slug: "mobile-patrols-key-holding",
    title: "Mobile Patrols & Key Holding",
    description: "Scheduled patrols and secure key holding for your premises.",
    icon: "/images/service-patrols.png",
    detail: {
      intro:
        "Scheduled patrols and secure key holding, so your premises are checked and accessible whenever you need.",
      heading: "Visible patrols, secure key holding",
      overview:
        "Our mobile patrol officers carry out scheduled checks of your premises, deterring intruders and spotting issues early. With our key holding service, your keys are held securely so your site can be accessed and secured without calling you out.",
      included: [
        "Scheduled patrols planned around your premises",
        "Secure key holding for fast access to your site",
        "A dedicated 24/7 Operations Team on call",
        "Real-time reporting through our clocking and tag point systems",
        "Coverage across Ireland from our base in the midlands",
      ],
      callout: "Need a patrol or key holder? Call our 24 Hour Number",
    },
  },
  {
    slug: "open-up-lock-ups",
    title: "Open Up & Lock Ups",
    description: "Reliable opening and locking of sites on your schedule.",
    icon: "/images/service-lockups.png",
    detail: {
      intro:
        "Reliable opening and locking of your sites, on your schedule, so you never have to make the trip yourself.",
      heading: "Your site, opened and secured on time",
      overview:
        "Our officers open up and lock up your premises at the times you set, checking that the site is secure before they leave. It is a simple way to make sure your business starts and ends each day safely.",
      included: [
        "Opening and locking of sites at times that suit you",
        "Security checks of the premises at every visit",
        "A dedicated 24/7 Operations Team on call",
        "Real-time reporting through our clocking and tag point systems",
        "Coverage across Ireland from our base in the midlands",
      ],
      callout: "Need a site opened or locked? Call our 24 Hour Number",
    },
  },
  {
    slug: "static-security",
    title: "Static Security",
    description: "Trained officers on site to protect people and property.",
    icon: "/images/service-static.png",
    detail: {
      intro:
        "Trained, uniformed officers on site to protect your people, property and assets.",
      heading: "Trained officers, on site",
      overview:
        "Our static security officers provide a visible, professional presence at your premises. Every officer receives exceptional training so you get a first class service, backed by our dedicated 24/7 Operations Team.",
      included: [
        "Trained, uniformed officers on your premises",
        "Access control and monitoring of people and property",
        "A dedicated 24/7 Operations Team on call",
        "Real-time reporting through our clocking and tag point systems",
        "Coverage across Ireland from our base in the midlands",
      ],
      callout: "Need officers on site? Call our 24 Hour Number",
    },
  },
  {
    slug: "commercial-retail-security",
    title: "Commercial & Retail Security",
    description: "Tailored security for offices, shops and retail centres.",
    icon: "/images/service-commercial.png",
    detail: {
      intro:
        "Tailored security for offices, shops and retail centres, planned around how your business runs.",
      heading: "Security tailored to your business",
      overview:
        "We work with commercial and retail clients to put the right security in place, from officers on the shop floor to patrols and alarm response. Every service is planned around your premises and your schedule.",
      included: [
        "Security planned around your premises and opening hours",
        "Trained officers for offices, shops and retail centres",
        "A dedicated 24/7 Operations Team on call",
        "Real-time reporting through our clocking and tag point systems",
        "Coverage across Ireland from our base in the midlands",
      ],
      callout: "Need commercial security? Call our 24 Hour Number",
    },
  },
  {
    slug: "event-security",
    title: "Event Security",
    description:
      "Professional crowd and access control for events of any size.",
    icon: "/images/service-event.png",
    detail: {
      intro:
        "Professional crowd and access control for events of any size, so your guests can enjoy the day safely.",
      heading: "Safe, well-run events",
      overview:
        "Our event security officers manage access, crowds and incidents so your event runs smoothly. We plan every event with you, from small private functions to large public gatherings.",
      included: [
        "Access control and crowd management",
        "Trained, uniformed officers for events of any size",
        "A dedicated 24/7 Operations Team on call",
        "Real-time reporting through our clocking and tag point systems",
        "Coverage across Ireland from our base in the midlands",
      ],
      callout: "Planning an event? Call our 24 Hour Number",
    },
  },
]

export const clients = [
  { name: "Dinn Rí", logo: "/images/client-dinn-ri.png" },
  { name: "Langton House Hotel", logo: "/images/client-langton.png" },
  { name: "Hayes Hotel", logo: "/images/client-hayes.png" },
  { name: "Martin Reddin", logo: "/images/client-martin-reddin.png" },
  { name: "Killeen Civil Engineering", logo: "/images/client-killeen.png" },
  { name: "Greenfield", logo: "/images/client-greenfield.png" },
  { name: "Telfords", logo: "/images/client-telfords.png" },
  { name: "Laois Hire", logo: "/images/client-laois-hire.png" },
]

export const team = [
  {
    name: "Michael McDonald",
    role: "Managing Director",
    bio: "Michael has over 20 years experience in the security industry. Having worked on the ground, he started his own security business in 2008 and takes pride in the reputation he has grown.",
    email: "info@securitypartnersltd.com",
  },
  {
    name: "John McDonald",
    role: "Operations Director",
    bio: "John has many years of security experience. He operationally runs the business and is dedicated to deploying officers on the ground and inducting on-site training.",
    email: "operations@securitypartnersltd.com",
  },
  {
    name: "Sarah Moran",
    role: "HR/Operations Manager",
    bio: "Sarah is CIPD qualified and is HR Manager. She also oversees the business day to day and is the point of contact for all operational queries.",
    email: "HR@securitypartnersltd.com",
  },
  {
    name: "Louise Sheeran",
    role: "Accounts Manager",
    bio: "Louise is IPASS qualified and looks after all accounts and invoicing. She is the point of contact for all invoicing queries.",
    email: "accounts@securitypartnersltd.com",
  },
]

export type PostBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; items: string[] }
  | { type: "quote"; text: string; cite: string }
  | { type: "image"; src: string; alt: string }

export type Post = {
  slug: string
  title: string
  excerpt: string
  category: string
  date: string
  displayDate: string
  cover: string
  author?: { name: string; role: string }
  readTime?: string
  // Article-page intro when it differs from the card excerpt.
  lead?: string
  tags?: string[]
  // Only posts with designed copy have a body; the rest show their excerpt.
  body?: PostBlock[]
}

const michael = { name: "Michael McDonald", role: "Managing Director" }

export const featuredPost: Post = {
  slug: "18-years-of-watching-over-ireland",
  title: "18 Years of Watching Over Ireland",
  excerpt:
    "Since 2008, Security Partners has grown from a family business in Mountmellick into a security team trusted by hotels, retailers and businesses across Ireland. Here's how we got here.",
  category: "Company News",
  date: "2026-09-20",
  displayDate: "20 Sep 2026",
  cover: "/images/hero.jpg",
  author: michael,
}

// Newest first.
export const posts: Post[] = [
  {
    slug: "mobile-patrols-protect-your-business-after-hours",
    title: "How Mobile Patrols Protect Your Business After Hours",
    excerpt:
      "What a scheduled patrol actually covers, and why visible security deters break-ins.",
    category: "Mobile Patrols",
    date: "2026-09-12",
    displayDate: "12 Sep 2026",
    cover: "/images/hero.jpg",
    author: michael,
    readTime: "5 min read",
    lead: "What a scheduled patrol actually covers, and why a visible security presence deters break-ins.",
    tags: ["Mobile Patrols", "Key Holding", "Business Security"],
    body: [
      {
        type: "p",
        text: "When your business closes for the night, it becomes an easy target. A mobile patrol puts clearly identifiable security officers on your premises at set times, so problems are found early and unwanted activity is deterred.",
      },
      { type: "h2", text: "What a scheduled patrol covers" },
      {
        type: "p",
        text: "Every patrol is planned around your site and your schedule. Our officers check the areas that matter most to you and report back to our Operations Team as they go.",
      },
      {
        type: "list",
        items: [
          "Perimeter, doors and windows checked for signs of entry",
          "Lights, alarms and equipment left in a safe state",
          "Tag point checks logged at every stop, in real time",
          "Any issue reported straight to our 24/7 Operations Team",
        ],
      },
      {
        type: "quote",
        text: "A visible security presence is one of the simplest ways to deter break-ins, vandalism and anti-social behaviour.",
        cite: "Security Partners Operations Team",
      },
      { type: "h2", text: "Pairing patrols with key holding" },
      {
        type: "p",
        text: "With key holding, our team holds secure keys to your premises. If your alarm is activated, an officer can be dispatched to deal with the situation, so you are not called out in the middle of the night.",
      },
      {
        type: "image",
        src: "/images/about.png",
        alt: "Security Partners officer completing a patrol report",
      },
      { type: "h2", text: "Is a mobile patrol right for you?" },
      {
        type: "p",
        text: "Mobile patrols suit offices, retail units, building sites and any premises left empty after hours. Get in touch and our team will recommend a patrol plan that fits your site.",
      },
    ],
  },
  {
    slug: "planning-security-for-your-next-event",
    title: "Planning Security for Your Next Event",
    excerpt:
      "From access control to crowd management: a checklist for organisers of events of any size.",
    category: "Event Security",
    date: "2026-08-28",
    displayDate: "28 Aug 2026",
    cover: "/images/banner.png",
  },
  {
    slug: "inside-our-24-7-operations-team",
    title: "Inside Our 24/7 Operations Team",
    excerpt:
      "How real-time reporting, clocking and tag point systems keep our clients informed around the clock.",
    category: "Company News",
    date: "2026-08-05",
    displayDate: "05 Aug 2026",
    cover: "/images/about.png",
  },
  {
    slug: "key-holding-explained",
    title: "Key Holding Explained: Who Responds When Your Alarm Goes Off",
    excerpt:
      "What happens after an alarm activation, and why a key holder saves you a call-out.",
    category: "Key Holding",
    date: "2026-07-02",
    displayDate: "02 Jul 2026",
    cover: "/images/about.png",
  },
  {
    slug: "loss-prevention-trained-retail-officers",
    title: "Loss Prevention: What Trained Retail Officers Do Differently",
    excerpt:
      "How our retail team keeps shops safe for the public while cutting losses.",
    category: "Retail Security",
    date: "2026-06-18",
    displayDate: "18 Jun 2026",
    cover: "/images/hero.jpg",
  },
  {
    slug: "open-up-lock-up-keeps-staff-safe",
    title: "Why Open Up & Lock Up Services Keep Your Staff Safe",
    excerpt:
      "A simple, secure way to make sure staff get in and out of work safely.",
    category: "Open Up & Lock Up",
    date: "2026-06-04",
    displayDate: "04 Jun 2026",
    cover: "/images/banner.png",
  },
]

export const allPosts = [featuredPost, ...posts]

export const blogFilters = [
  "Company News",
  "Mobile Patrols",
  "Event Security",
  "Retail Security",
  "Alarm Response",
]

export const groupCompanies = [
  {
    name: "MJS Eco",
    phone: "(087) 924 8880",
    phoneHref: "tel:+353879248880",
    site: "www.mjseco.ie",
    logo: "/images/group-mjs-eco.png",
  },
  {
    name: "Cleaning Partners",
    phone: "085 806 2369",
    phoneHref: "tel:+353858062369",
    site: "www.cleaningpartners.ie",
    logo: "/images/group-cleaning-partners.png",
  },
]
