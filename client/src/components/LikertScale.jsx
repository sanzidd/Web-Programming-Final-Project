import React from 'react';
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
  { value: 1, label: 'Not at all' }
];

export default function LikertScale({ question, value, onChange, variant = 'likert' }) {
  const options = variant === 'achievement' ? ACHIEVEMENT_OPTIONS : LIKERT_OPTIONS;

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
            <span className="likert-label">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
