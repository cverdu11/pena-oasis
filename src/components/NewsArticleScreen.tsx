import {
  HiOutlineArrowLeft,
  HiOutlineArrowTopRightOnSquare,
} from "react-icons/hi2";
import { FEATURED_NEWS } from "../lib/news";

type NewsArticleScreenProps = {
  onBack: () => void;
};

export function NewsArticleScreen({ onBack }: NewsArticleScreenProps) {
  return (
    <section className="screen hub-screen" aria-label="Noticia">
      <div className="hub-backdrop" aria-hidden="true" />
      <article className="hub-sheet news-article-sheet">
        <header className="news-article-header">
          <button type="button" aria-label="Volver a Inicio" onClick={onBack}>
            <HiOutlineArrowLeft aria-hidden="true" />
          </button>
          <div>
            <p>Peña Oasis</p>
            <h1>Últimas noticias</h1>
          </div>
        </header>

        <div className="news-article-intro">
          <p>{FEATURED_NEWS.category}</p>
          <h2>{FEATURED_NEWS.title}</h2>
          <span>
            La Peña Oasis es una de las cinco nuevas agrupaciones que pasan a
            formar parte de la Federación.
          </span>
          <small>
            {FEATURED_NEWS.author} · {FEATURED_NEWS.publishedAt} ·{" "}
            {FEATURED_NEWS.source}
          </small>
        </div>

        <figure className="news-article-image">
          <img src={FEATURED_NEWS.imageUrl} alt={FEATURED_NEWS.imageAlt} />
          <figcaption>Imagen: {FEATURED_NEWS.imageCredit}</figcaption>
        </figure>

        <div className="news-article-body">
          {FEATURED_NEWS.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <footer className="news-article-source">
          <span>
            Fuente: <strong>{FEATURED_NEWS.source}</strong>
          </span>
          <a
            href={FEATURED_NEWS.originalUrl}
            target="_blank"
            rel="noreferrer"
          >
            Ver publicación original
            <HiOutlineArrowTopRightOnSquare aria-hidden="true" />
          </a>
        </footer>
      </article>
    </section>
  );
}
