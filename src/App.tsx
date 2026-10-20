import { HashRouter, Link, Route, Routes } from 'react-router-dom';
import { Layout } from './core/Layout';
import { COURSES } from './courses';
import Mech430 from './courses/mech430/Course';
import Mech412 from './courses/mech412/Course';
import Mech346 from './courses/mech346/Course';
import Mech341 from './courses/mech341/Course';

function Home() {
  return (
    <Layout crumbs="Home">
      <p className="eyebrow">McGill Mechanical Engineering</p>
      <h1>Engineering Revision</h1>
      <p className="lede">
        One guide per course, built from my lecture notes, problem sets and past exams — with the reasoning written out
        and simulations to see the physics.
      </p>
      <div className="grid" style={{ marginTop: '1.5rem' }}>
        {COURSES.map((c) =>
          c.status === 'live' ? (
            <Link key={c.slug} to={`/${c.slug}`} className="card course-card">
              <span className="code">
                {c.code} <span className="pill live">live</span>
              </span>
              <span className="title">{c.title}</span>
              <span className="meta">{c.term}</span>
              <span>{c.blurb}</span>
            </Link>
          ) : (
            <div key={c.slug} className="card course-card soon" style={{ opacity: 0.6 }}>
              <span className="code">
                {c.code} <span className="pill">soon</span>
              </span>
              <span className="title">{c.title}</span>
              <span className="meta">{c.term}</span>
              <span>{c.blurb}</span>
            </div>
          ),
        )}
      </div>
    </Layout>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/mech430/*" element={<Mech430 />} />
        <Route path="/mech412/*" element={<Mech412 />} />
        <Route path="/mech346/*" element={<Mech346 />} />
        <Route path="/mech341/*" element={<Mech341 />} />
      </Routes>
    </HashRouter>
  );
}
