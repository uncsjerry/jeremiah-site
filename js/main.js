// ============================================
// Jeremiah Gutierrez — Editorial Site JS
// ============================================

(function () {
  'use strict';

  // -------------------------------------------
  // Custom cursor
  // -------------------------------------------
  const cursor = document.getElementById('cursor');
  if (cursor && window.matchMedia('(pointer: fine)').matches) {
    document.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    });

    // WHY: Expand cursor on interactive elements to signal clickability
    const interactives = document.querySelectorAll('a, button, input, select, textarea, .panel');
    interactives.forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('hovering'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('hovering'));
    });
  }

  // -------------------------------------------
  // Menu overlay
  // -------------------------------------------
  const menuBtn = document.getElementById('menuBtn');
  const navOverlay = document.getElementById('navOverlay');

  if (menuBtn && navOverlay) {
    menuBtn.addEventListener('click', () => {
      const isOpen = navOverlay.classList.contains('open');
      navOverlay.classList.toggle('open');
      menuBtn.classList.toggle('active');
      menuBtn.setAttribute('aria-expanded', !isOpen);
      document.body.style.overflow = isOpen ? '' : 'hidden';
    });

    navOverlay.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navOverlay.classList.remove('open');
        menuBtn.classList.remove('active');
        menuBtn.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  // -------------------------------------------
  // Smooth scroll for anchor links
  // -------------------------------------------
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // -------------------------------------------
  // Reveal-on-scroll
  // -------------------------------------------
  const reveals = document.querySelectorAll('.reveal-up');
  if (reveals.length > 0) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 } // WHY: Trigger slightly before fully visible for fluid feel
    );
    reveals.forEach(el => observer.observe(el));
  }

  // -------------------------------------------
  // Counter animation
  // -------------------------------------------
  const counters = document.querySelectorAll('.counter');
  if (counters.length > 0) {
    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const target = parseInt(el.getAttribute('data-target'), 10);
            const duration = 2000;
            const start = performance.now();

            function update(now) {
              const elapsed = now - start;
              const progress = Math.min(elapsed / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              el.textContent = Math.floor(eased * target);
              if (progress < 1) {
                requestAnimationFrame(update);
              } else {
                el.textContent = target;
              }
            }
            requestAnimationFrame(update);
            counterObserver.unobserve(el);
          }
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach(el => counterObserver.observe(el));
  }

  // -------------------------------------------
  // Horizontal scroll — drag to scroll
  // -------------------------------------------
  const hscroll = document.querySelector('.hscroll-wrapper');
  if (hscroll) {
    let isDown = false;
    let startX;
    let scrollLeft;

    hscroll.addEventListener('mousedown', (e) => {
      isDown = true;
      hscroll.style.cursor = 'grabbing';
      startX = e.pageX - hscroll.offsetLeft;
      scrollLeft = hscroll.scrollLeft;
    });

    hscroll.addEventListener('mouseleave', () => {
      isDown = false;
      hscroll.style.cursor = '';
    });

    hscroll.addEventListener('mouseup', () => {
      isDown = false;
      hscroll.style.cursor = '';
    });

    hscroll.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - hscroll.offsetLeft;
      const walk = (x - startX) * 1.5; // WHY: 1.5x multiplier makes drag feel responsive
      hscroll.scrollLeft = scrollLeft - walk;
    });
  }

  // -------------------------------------------
  // Contact form
  // -------------------------------------------
  const form = document.getElementById('contactForm');
  const submitBtn = document.getElementById('submitBtn');

  if (form && submitBtn) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Sending...';
      submitBtn.disabled = true;

      // WHY: Simulated — replace with real endpoint (Formspree, Netlify Forms, etc.)
      setTimeout(() => {
        submitBtn.textContent = 'Sent! Talk soon.';
        submitBtn.classList.add('success');
        form.reset();

        setTimeout(() => {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          submitBtn.classList.remove('success');
        }, 3000);
      }, 1500);
    });
  }

  // -------------------------------------------
  // Parallax-lite for hero background letter
  // -------------------------------------------
  const hero = document.querySelector('.hero');
  if (hero) {
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY;
      const rate = scrolled * 0.15;
      // WHY: Moves the giant "J" letter at a slower rate than scroll for depth
      hero.style.setProperty('--parallax', rate + 'px');
    });
  }

})();
