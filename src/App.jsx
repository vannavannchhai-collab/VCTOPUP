import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Shop from './pages/Shop.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import CartPage from './pages/CartPage.jsx';
import Checkout from './pages/Checkout.jsx';
import Payment from './pages/Payment.jsx';
import OrderSuccess from './pages/OrderSuccess.jsx';
import Track from './pages/Track.jsx';
import Login from './pages/Login.jsx';
import Account from './pages/Account.jsx';
import Admin from './pages/Admin.jsx';
import Contact from './pages/Contact.jsx';
import About from './pages/About.jsx';
import NotFound from './pages/NotFound.jsx';

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const id = hash.slice(1);
      let tries = 0;
      const scroll = () => {
        const el = document.getElementById(id);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        if (tries++ < 20) setTimeout(scroll, 80);
      };
      setTimeout(scroll, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [pathname, hash]);
  return null;
}

/* Adds .in to any .reveal element as it scrolls into view (including dynamically
   rendered cards, table rows, etc.). */
function RevealManager() {
  const location = useLocation();
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); observer.unobserve(e.target); }
      });
    }, { threshold: .06, rootMargin: '0px 0px -20px 0px' });

    const scan = () => document.querySelectorAll('.reveal:not(.in)').forEach((el) => observer.observe(el));
    scan();
    const mutation = new MutationObserver(() => scan());
    mutation.observe(document.body, { childList: true, subtree: true });
    const timer = setInterval(scan, 600);
    return () => { observer.disconnect(); mutation.disconnect(); clearInterval(timer); };
  }, [location.pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollManager />
      <RevealManager />
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/pay/:code" element={<Payment />} />
          <Route path="/order/:code" element={<OrderSuccess />} />
          <Route path="/track" element={<Track />} />
          <Route path="/login" element={<Login />} />
          <Route path="/account" element={<Account />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </>
  );
}
