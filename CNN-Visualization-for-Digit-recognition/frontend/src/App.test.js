import { render, screen } from '@testing-library/react';
import App from './App';

test('renders visualizer title', () => {
  render(<App />);
  const titleElement = screen.getByText(/interactive cnn visualizer for digit recognition/i);
  expect(titleElement).toBeInTheDocument();
});
