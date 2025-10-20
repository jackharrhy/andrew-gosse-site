import type { Schema, Struct } from '@strapi/strapi';

export interface SharedMedia extends Struct.ComponentSchema {
  collectionName: 'components_shared_media';
  info: {
    displayName: 'Media';
    icon: 'file-video';
  };
  attributes: {
    file: Schema.Attribute.Media<'images' | 'files' | 'videos'> &
      Schema.Attribute.Required;
  };
}

export interface SharedRichText extends Struct.ComponentSchema {
  collectionName: 'components_shared_rich_texts';
  info: {
    description: '';
    displayName: 'Rich text';
    icon: 'align-justify';
  };
  attributes: {
    body: Schema.Attribute.RichText;
  };
}

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seos';
  info: {
    description: '';
    displayName: 'SEO';
    icon: 'question';
    name: 'Seo';
  };
  attributes: {
    metaDescription: Schema.Attribute.Text;
    metaTitle: Schema.Attribute.String & Schema.Attribute.Required;
    shareImage: Schema.Attribute.Media<'images'>;
  };
}

export interface SharedSidebarCategory extends Struct.ComponentSchema {
  collectionName: 'components_shared_sidebar_categories';
  info: {
    displayName: 'Sidebar Category';
    icon: 'grid';
  };
  attributes: {
    categoryTitle: Schema.Attribute.String;
    items: Schema.Attribute.Component<'shared.sidebar-item', true> &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
  };
}

export interface SharedSidebarItem extends Struct.ComponentSchema {
  collectionName: 'components_shared_sidebar_items';
  info: {
    displayName: 'Sidebar Item';
    icon: 'archive';
  };
  attributes: {
    page: Schema.Attribute.Relation<'oneToOne', 'api::page.page'>;
    text: Schema.Attribute.String;
  };
}

export interface SharedSidebarLink extends Struct.ComponentSchema {
  collectionName: 'components_shared_sidebar_links';
  info: {
    displayName: 'Sidebar Link';
    icon: 'link';
  };
  attributes: {
    service: Schema.Attribute.Enumeration<
      [
        'Bandcamp',
        'YouTube',
        'Instagram',
        'LinkedIn',
        'GitHub',
        'Itch.io',
        'IMDB',
      ]
    > &
      Schema.Attribute.Required;
    url: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'shared.media': SharedMedia;
      'shared.rich-text': SharedRichText;
      'shared.seo': SharedSeo;
      'shared.sidebar-category': SharedSidebarCategory;
      'shared.sidebar-item': SharedSidebarItem;
      'shared.sidebar-link': SharedSidebarLink;
    }
  }
}
