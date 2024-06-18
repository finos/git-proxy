import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { LinkedInEmbed } from 'react-social-media-embed';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

/**
 * Home page component
 * @return {JSX.Element}
 */
function Testimonials() {
  const context = useDocusaurusContext();
  const { siteConfig = {} } = context;
  const { posts } = siteConfig.customFields;
  const settings = {
    infinite: true,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 3,
    swipeToSlide: true,
    swipe: true,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 2,
          infinite: true,
          dots: true,
        },
      },
      {
        breakpoint: 800,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
          initialSlide: 1,
        },
      },
    ],
    dots: true,
    arrows: true,
  };

  return (
    <div className='margin-top--md'>
      <div className='container text--center'>
        <h1 className=''>Testimonials 📣</h1>
      </div>

      <div className='container margin-top--xl margin-bottom--xl'>
        <Slider {...settings}>
          {posts
            .filter((post) => post.platform === 'linkedin')
            .map((post) => {
              return (
                <div key={post.url}>
                  <LinkedInEmbed url={post.url} />
                </div>
              );
            })}
        </Slider>
      </div>
    </div>
  );
}

export default Testimonials;
