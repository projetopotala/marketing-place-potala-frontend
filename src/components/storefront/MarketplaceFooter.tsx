import { PrivacyPreferencesButton } from "@/components/analytics/AnalyticsProvider";
import {
  BRAND,
  CONTACT_INFO,
  FOOTER_COLUMNS,
  PAYMENT_METHODS,
  SOCIAL_LINKS,
} from "@/data/marketplace";
import Link from "next/link";
import { BrandLogo } from "@/components/storefront/BrandLogo";
import { PaymentBrand } from "@/components/storefront/PaymentBrand";
import {
  ClockIcon,
  FacebookIcon,
  InstagramIcon,
  MailIcon,
  PinterestIcon,
  WhatsAppIcon,
  YoutubeIcon,
} from "@/components/storefront/icons";

const socialIcons = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  youtube: YoutubeIcon,
  pinterest: PinterestIcon,
} as const;

export function MarketplaceFooter() {
  const phoneHref = `tel:${CONTACT_INFO.phone.replace(/\D/g, "")}`;

  return (
    <footer id="contato" className="marketplace-footer">
      <div className="marketplace-footer__container">
        <div className="marketplace-footer__brand">
          <Link href="/#topo" className="inline-flex focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-potala-gold">
            <BrandLogo variant="footer" />
          </Link>
          <p className="marketplace-footer__description">{BRAND.description}</p>
          <ul className="marketplace-footer__social">
            {SOCIAL_LINKS.map((social) => {
              const Icon = socialIcons[social.id];
              return (
                <li key={social.id}>
                  {social.href ? (
                    <a
                      href={social.href}
                      className="marketplace-footer__social-link"
                      aria-label={social.label}
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  ) : (
                    <span
                      className="marketplace-footer__social-link"
                      aria-label={`${social.label} (em breve)`}
                      title="Link oficial ainda não disponível"
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        {FOOTER_COLUMNS.map((column) => (
          <div key={column.title} className="marketplace-footer__column">
            <h2 className="marketplace-footer__heading">{column.title}</h2>
            <ul className="marketplace-footer__links">
              {column.links.map((link) => (
                <li key={link.label}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="marketplace-footer__column marketplace-footer__contact">
          <h2 className="marketplace-footer__heading">Fale Conosco</h2>
          <Link href="/contato" className="underline">Enviar mensagem de atendimento</Link>
          <ul className="marketplace-footer__contact-list">
            <li>
              <span className="marketplace-footer__contact-icon" aria-hidden="true">
                <WhatsAppIcon />
              </span>
              <a href={phoneHref}>{CONTACT_INFO.phone}</a>
            </li>
            <li>
              <span className="marketplace-footer__contact-icon" aria-hidden="true">
                <MailIcon />
              </span>
              <a href={`mailto:${CONTACT_INFO.email}`}>{CONTACT_INFO.email}</a>
            </li>
            <li>
              <span className="marketplace-footer__contact-icon" aria-hidden="true">
                <ClockIcon />
              </span>
              <span>
                {CONTACT_INFO.hours.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="marketplace-footer__bottom">
        <div className="marketplace-footer__bottom-inner">
          <div><PrivacyPreferencesButton /></div>
          <p className="marketplace-footer__copyright">
            © {new Date().getFullYear()} Instituto Potala Marketplace. Todos os
            direitos reservados.
          </p>
          <ul
            className="marketplace-footer__payments"
            aria-label="Formas de pagamento"
          >
            {PAYMENT_METHODS.map((method) => (
              <li key={method.id}>
                <PaymentBrand method={method} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
