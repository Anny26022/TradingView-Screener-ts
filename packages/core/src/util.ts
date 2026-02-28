export function formatTechnicalRating(rating: number): string {
  if (rating >= 0.5) {
    return 'Strong Buy';
  }
  if (rating >= 0.1) {
    return 'Buy';
  }
  if (rating >= -0.1) {
    return 'Neutral';
  }
  if (rating >= -0.5) {
    return 'Sell';
  }
  return 'Strong Sell';
}

export const format_technical_rating = formatTechnicalRating;
