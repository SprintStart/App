import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface SEOHeadProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

export function SEOHead({ title, description, image, url }: SEOHeadProps) {
  const location = useLocation();

  const defaultTitle = 'StartSprint — Challenge Your Mind';
  const defaultDescription = 'Fast, fun quizzes for students. Play solo or in Immersive Mode — and share your score in seconds.';
  const defaultImage = 'https://startsprint.app/api/og/result';
  const baseUrl = window.location.origin;

  const pageTitle = title || defaultTitle;
  const pageDescription = description || defaultDescription;
  const pageImage = image || defaultImage;
  const pageUrl = url || `${baseUrl}${location.pathname}`;

  useEffect(() => {
    document.title = pageTitle;

    const metaTags = [
      { name: 'description', content: pageDescription },
      { property: 'og:title', content: pageTitle },
      { property: 'og:description', content: pageDescription },
      { property: 'og:image', content: pageImage },
      { property: 'og:url', content: pageUrl },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: pageTitle },
      { name: 'twitter:description', content: pageDescription },
      { name: 'twitter:image', content: pageImage },
    ];

    metaTags.forEach(({ name, property, content }) => {
      const selector = property ? `meta[property="${property}"]` : `meta[name="${name}"]`;
      let element = document.querySelector(selector);

      if (!element) {
        element = document.createElement('meta');
        if (property) {
          element.setAttribute('property', property);
        } else {
          element.setAttribute('name', name!);
        }
        document.head.appendChild(element);
      }

      element.setAttribute('content', content);
    });

    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', pageUrl);
  }, [pageTitle, pageDescription, pageImage, pageUrl]);

  return null;
}

export function getTopicSEO(topicName: string, subject: string) {
  return {
    title: `${topicName} Quiz - ${subject.charAt(0).toUpperCase() + subject.slice(1)} | StartSprint`,
    description: `Test your knowledge on ${topicName}. Interactive ${subject} quiz with instant feedback and detailed explanations. Perfect for students and learners.`,
  };
}

export function getSubjectSEO(subject: string) {
  return {
    title: `${subject.charAt(0).toUpperCase() + subject.slice(1)} Quizzes | StartSprint`,
    description: `Explore ${subject} topics and challenge yourself with interactive quizzes. Learn through practice with instant feedback and progress tracking.`,
  };
}
