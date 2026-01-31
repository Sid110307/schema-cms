export const welcomeDoc = `Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Quisque molestie scelerisque tortor.
Sed iaculis imperdiet magna sed tempor.
Sed eget lobortis mi.
Duis sollicitudin tristique nibh molestie pellentesque.
Nam luctus varius ultricies.
Nunc viverra ipsum ipsum, ac tincidunt augue egestas non.
Quisque posuere congue est, vel tempor elit euismod commodo.
Aliquam id urna laoreet, commodo nisl eleifend, dictum mi.

Phasellus finibus turpis non magna ultrices dictum.
Integer id lobortis orci.
In cursus, lectus id cursus cursus, lacus justo malesuada nibh, non ultrices leo est in tellus.
Vestibulum nec nisi id justo finibus aliquam non ut purus.
Phasellus nec ornare odio.
Aliquam erat volutpat.
Aenean fringilla non enim in ultricies.
Nulla at diam sit amet velit pretium aliquam.
Morbi eleifend elit turpis, at dignissim sapien sodales et.
Fusce euismod, quam vel tristique placerat, augue odio sollicitudin sem, eu ultrices sapien mauris in ante.
Praesent posuere congue massa vulputate viverra.
`;

export const mediaGallery = [
    "https://picsum.photos/id/1015/1200/800.jpg",
    "https://picsum.photos/id/1025/1200/800.jpg",
    "https://picsum.photos/id/1035/1200/800.jpg",
    "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
];

export const publications = [
    {
        title: "Title of Published Paper 1",
        authors: "A. Author, B. Author",
        publisherName: "Some Journal",
        year: "2023",
        link: "https://example.com/paper-1",
    },
    {
        title: "Title of Published Paper 2",
        authors: "C. Author, D. Author",
        publisherName: "Conference X",
        year: "2024",
        link: "https://example.com/paper-2",
    },
    {
        title: "Title of Published Paper 3",
        authors: "E. Author",
        publisherName: "Tech Reports",
        year: "2025",
        link: "https://example.com/paper-3",
    },
];

export const teamGraph = {
    lead: {
        name: "Alice",
        designation: "Lab Lead",
        specialRemarks: "Principal Investigator",
        img: "https://i.pravatar.cc/512?img=5",
    },

    contact: {
        office: "Room 301, Building A",
        lab: "Systems Lab",
        email: "alice@example.com",
    },
    members: [
        {
            name: "Charlie",
            designation: "Research Engineer",
            specialRemarks: "Editor UX + schema system",
            img: "https://i.pravatar.cc/512?img=12",
        },
        {
            name: "Kirk",
            designation: "Graduate Student",
            specialRemarks: "Graph editing + data models",
            img: "https://i.pravatar.cc/512?img=33",
        },
    ],
    highlights: [
        { title: "New paper accepted", link: "https://example.com/news-1" },
        { title: "Workshop talk announced", link: "https://example.com/news-2" },
        { title: "Open-source release", link: "https://example.com/news-3" },
    ],
};

export const siteConfig = {
    hero: {
        headline: "Schema CMS",
        subtext: "An extensible CMS/editor for working with structured JS objects.",
        ctaText: "Get Started",
        ctaLink: "https://example.com",
        banner: "https://picsum.photos/id/1003/1600/600.jpg",
    },
    footer: {
        copyright: "© 2026 Schema CMS. All rights reserved.",
        links: [
            { title: "Docs", link: "https://example.com/docs" },
            { title: "GitHub", link: "https://example.com/github" },
            { title: "Contact", link: "https://example.com/contact" },
        ],
    },
};
