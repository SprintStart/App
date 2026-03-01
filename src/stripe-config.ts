export interface Product {
  id: string;
  priceId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  mode: 'payment' | 'subscription';
}

export const products: Product[] = [
  {
    id: 'prod_Tsifff7KS8CYMm_monthly',
    priceId: 'price_1SwRyWR2rhkSk4b6iZoJmm8H',
    name: 'StartSprint Teachers - Monthly',
    description: 'A lightning-fast quiz game app for browsers and immersive displays. Challenge yourself with topic-based question runs, earn points, and master your knowledge with instant feedback. Perfect for classrooms, team-building, or just a quick mental workout.',
    price: 9.99,
    currency: 'GBP',
    mode: 'subscription'
  },
  {
    id: 'prod_Tsifff7KS8CYMm',
    priceId: 'price_1SuxE0R2rhkSk4b6BP4RXkyn',
    name: 'StartSprint Teachers - Annual',
    description: 'A lightning-fast quiz game app for browsers and immersive displays. Challenge yourself with topic-based question runs, earn points, and master your knowledge with instant feedback. Perfect for classrooms, team-building, or just a quick mental workout.',
    price: 99.99,
    currency: 'GBP',
    mode: 'subscription'
  }
];

export function getProductById(id: string): Product | undefined {
  return products.find(product => product.id === id);
}

export function getProductByPriceId(priceId: string): Product | undefined {
  return products.find(product => product.priceId === priceId);
}