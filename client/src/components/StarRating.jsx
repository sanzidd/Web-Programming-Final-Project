import { useState } from 'react';
import { Star } from 'lucide-react';
import './StarRating.css';

export default function StarRating({ value = 0, onChange, size = 28, readonly = false, label = '' }) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="star-rating-wrapper">
      {label && <span className="star-rating-label">{label}</span>}
      <div className="star-rating" role="radiogroup" aria-label={label || 'Rating'}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`star ${star <= (hovered || value) ? 'active' : ''} ${
              hovered >= star ? 'hovered' : ''
            } ${readonly ? 'readonly' : ''}`}
            onClick={() => !readonly && onChange?.(star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(0)}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            disabled={readonly}
          >
            <Star size={size} fill={star <= (hovered || value) ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
      {value > 0 && (
        <span className="star-rating-value">{value}.0</span>
      )}
    </div>
  );
}
