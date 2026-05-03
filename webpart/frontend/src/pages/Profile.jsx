import avatarImg from '../assets/avatar.jpg';
import reportPdf from '../assets/IOTl1.pdf';

export default function Profile() {
  return (
    <>
      <h1 className="page-title">Profile</h1>

      <div className="card profile-card">
        {/* Header: Avatar + Info */}
        <div className="profile-head">
          <img
            className="avatar"
            src={avatarImg}
            alt="Avatar"
            onError={e => {
              e.target.style.display = 'none';
            }}
          />
          <div>
            <h2>Điền Ngọc Hải</h2>
            <ul className="profile-info">
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
                </svg>
                Công nghệ Đa phương tiện – Học viện Công nghệ Bưu chính Viễn thông
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                26/09/2004
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92V21a1 1 0 0 1-1.11 1A19 19 0 0 1 2 4.11 1 1 0 0 1 3 3h4.09a1 1 0 0 1 1 .75l1 4a1 1 0 0 1-.29 1L7 10.5a16 16 0 0 0 6.5 6.5l1.75-1.75a1 1 0 0 1 1-.29l4 1a1 1 0 0 1 .75 1Z" />
                </svg>
                0337285594
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-10 6L2 7" />
                </svg>
                haidn2692004@gmail.com
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m3 11 9-8 9 8" />
                  <path d="M5 10v10h14V10" />
                </svg>
                Hà Đông, Hà Nội
              </li>
            </ul>
          </div>
        </div>

        <div className="divider" />

        {/* Link pills */}
        <div className="profile-links">
          <a
            className="link-pill"
            href="https://github.com/haidayn/IOTwebapp/tree/master"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2.9-.3 2-.4 3-.4s2.1.1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.7.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5Z" />
            </svg>
            GitHub Repository
          </a>

          <a
            className="link-pill"
            href="https://documenter.getpostman.com/view/54482468/2sBXqKp11z"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m16 18 6-6-6-6" />
              <path d="m8 6-6 6 6 6" />
            </svg>
            Postman API Docs
          </a>

          <a
            className="link-pill"
            href={reportPdf}
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M9 13h6M9 17h4" />
            </svg>
            Báo cáo PDF
          </a>

          <a
            className="link-pill"
            href="https://www.figma.com/design/g803lLu8EuhNofeiTfTBIE/IoTWEB?node-id=0-1&t=E9dFVyM9Edp2sC61-1"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5Z" />
              <path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12Z" />
              <path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5Z" />
              <circle cx="15.5" cy="12.5" r="3.5" />
              <path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0Z" />
            </svg>
            Figma Design
          </a>
        </div>
      </div>
    </>
  );
}
