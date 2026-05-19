import React from 'react';
import './LikertScale.css';

const OPTIONS = [
  { value: 5, label: 'Strongly Agree' },
  { value: 4, label: 'Agree' },
  { value: 3, label: 'Neutral' },
  { value: 2, label: 'Disagree' },
  { value: 1, label: 'Strongly Disagree' }
];

export default function LikertScale({ question, value, onChange }) {
  return (
    <div className="likert-container">
      <p className="likert-question">{question}</p>
      <div className="likert-options">
        {OPTIONS.map(opt => (
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
