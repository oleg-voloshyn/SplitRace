import { Controller } from 'react-hook-form';
import { Text, TextInput, View } from 'react-native';

// Thin wrapper that hooks a TextInput into react-hook-form. Only the field
// re-renders when its value changes; the rest of the form is untouched.
//
//   <FormTextInput
//     control={control}
//     name="email"
//     placeholder="Email"
//     rules={{ required: 'Email is required' }}
//     transform={(v) => v.trim().toLowerCase()}  // optional onChange filter
//     errorMessage={errors.email?.message}
//     // ...plus any TextInput prop (keyboardType, secureTextEntry, etc.)
//   />
function FormTextInput({ control, name, rules, transform, errorMessage, className, label, ...textInputProps }) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { value, onChange, onBlur } }) => (
        <View className={label ? '' : undefined}>
          {label ? <Text className="text-xs text-gray-500 mb-1.5">{label}</Text> : null}
          <TextInput
            {...textInputProps}
            value={value ?? ''}
            onChangeText={(v) => onChange(transform ? transform(v) : v)}
            onBlur={onBlur}
            placeholderTextColor={textInputProps.placeholderTextColor ?? '#9ca3af'}
            className={`${className ?? 'border border-gray-300 rounded-lg p-3 text-[15px] bg-white'} ${
              errorMessage ? 'border-red-500' : ''
            }`}
          />
          {errorMessage ? <Text className="text-red-600 text-xs mt-1.5">{errorMessage}</Text> : null}
        </View>
      )}
    />
  );
}

export default FormTextInput;
