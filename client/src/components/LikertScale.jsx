import './LikertScale.css';

const LIKERT_OPTIONS = [
  { value: 5, label: 'Strongly Agree' },
  { value: 4, label: 'Agree' },
  { value: 3, label: 'Neutral' },
  { value: 2, label: 'Disagree' },
  { value: 1, label: 'Strongly Disagree' }
];

const ACHIEVEMENT_OPTIONS = [
  { value: 5, label: 'Completely' },
  { value: 4, label: 'Significantly' },
  { value: 3, label: 'Moderately' },
  { value: 2, label: 'Slightly' },
  { value: 1, label: 'Not At All' }
];

// Numeric 1-5 rating (used for the Course Teacher evaluation)
const NUMERIC_OPTIONS = [
  { value: 1, label: '1', hint: 'Poor' },
  { value: 2, label: '2', hint: 'Fair' },
  { value: 3, label: '3', hint: 'Good' },
  { value: 4, label: '4', hint: 'Very Good' },
  { value: 5, label: '5', hint: 'Excellent' }
];

export default function LikertScale({ question, value, onChange, variant = 'likert' }) {
  const options = variant === 'achievement'
    ? ACHIEVEMENT_OPTIONS
    : variant === 'numeric'
      ? NUMERIC_OPTIONS
      : LIKERT_OPTIONS;

  return (
    <div className="likert-container">
      <p className="likert-question">{question}</p>
      <div className="likert-options">
        {options.map(opt => (
          <label 
            key={opt.value} 
            className={`likert-option ${value === opt.value ? 'selected' : ''}`}
          >
            <input 
              type="radio" 
              name={question} 
              value={opt.value} 
              checked={value === opt.value} 
              onChange={() => onChange(opt.value)} 
            />
            <span className="likert-radio-custom"></span>
            <span className={`likert-label ${variant === 'numeric' ? 'likert-label-numeric' : ''}`}>{opt.label}</span>
            {opt.hint && <span className="likert-hint">{opt.hint}</span>}
          </label>
        ))}
      </div>
    </div>
  );
}
