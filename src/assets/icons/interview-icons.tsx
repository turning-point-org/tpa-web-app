import React from 'react';

interface IconProps {
  className?: string;
  onClick?: () => void;
}

export const ChatIcon: React.FC<IconProps> = ({ className, onClick }) => (
  <svg 
    width="27" 
    height="25" 
    viewBox="0 0 27 25" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    onClick={onClick}
  >
    <g opacity="0.75" filter="url(#filter0_d_chat)">
      <path d="M22.3189 5.49371V16.3281C22.3189 16.6873 22.1762 17.0318 21.9222 17.2858C21.6682 17.5398 21.3237 17.6824 20.9646 17.6824H9.70691L6.94752 20.066L6.9399 20.0719C6.69615 20.2786 6.38678 20.3917 6.06722 20.391C5.86854 20.3907 5.67235 20.3468 5.49249 20.2624C5.25853 20.1546 5.06059 19.9816 4.92234 19.7643C4.78409 19.5469 4.71138 19.2943 4.71291 19.0367V5.49371C4.71291 5.13452 4.8556 4.79005 5.10958 4.53607C5.36356 4.28209 5.70803 4.1394 6.06722 4.1394H20.9646C21.3237 4.1394 21.6682 4.28209 21.9222 4.53607C22.1762 4.79005 22.3189 5.13452 22.3189 5.49371Z" fill="currentColor"/>
    </g>
    <defs>
      <filter id="filter0_d_chat" x="0.712891" y="0.139404" width="25.6064" height="24.2516" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="BackgroundImageFix"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset/>
        <feGaussianBlur stdDeviation="2"/>
        <feComposite in2="hardAlpha" operator="out"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.15 0"/>
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_chat"/>
        <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_chat" result="shape"/>
      </filter>
    </defs>
  </svg>
);

export const PainPointIcon: React.FC<IconProps> = ({ className, onClick }) => (
  <svg 
    width="13" 
    height="28" 
    viewBox="0 0 13 28" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    onClick={onClick}
  >
    <g opacity="0.75" filter="url(#filter0_d_painpoint)">
      <path fillRule="evenodd" clipRule="evenodd" d="M5.75697 23.9043C5.20468 23.9043 4.75697 23.4566 4.75697 22.9043L4.75697 21.0525C4.75697 20.5002 5.20468 20.0525 5.75697 20.0525L7.26953 20.0525C7.82182 20.0525 8.26953 20.5002 8.26953 21.0525L8.26953 22.9043C8.26953 23.4566 7.82182 23.9043 7.26953 23.9043L5.75697 23.9043Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M5.76087 17.6508C5.20859 17.6508 4.76087 17.2031 4.76087 16.6508L4.76087 5.62476C4.76087 5.07247 5.20859 4.62476 5.76087 4.62476L7.27344 4.62476C7.82572 4.62476 8.27344 5.07247 8.27344 5.62476L8.27344 16.6508C8.27344 17.2031 7.82572 17.6508 7.27344 17.6508L5.76087 17.6508Z" fill="currentColor"/>
    </g>
    <defs>
      <filter id="filter0_d_painpoint" x="0.756836" y="0.624756" width="11.5166" height="27.2795" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="BackgroundImageFix"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset/>
        <feGaussianBlur stdDeviation="2"/>
        <feComposite in2="hardAlpha" operator="out"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.15 0"/>
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_painpoint"/>
        <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_painpoint" result="shape"/>
      </filter>
    </defs>
  </svg>
);

export const InterviewIcon: React.FC<IconProps> = ({ className, onClick }) => (
  <svg 
    width="31" 
    height="23" 
    viewBox="0 0 31 23" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    onClick={onClick}
  >
    <g opacity="0.75" filter="url(#filter0_d_interview)">
      <path d="M15.2638 14.4248C16.1668 13.6988 16.8145 12.7248 17.1191 11.6347C17.4237 10.5447 17.3704 9.3914 16.9665 8.3313C16.5625 7.2712 15.8275 6.35557 14.8611 5.70859C13.8947 5.06162 12.7437 4.7146 11.5641 4.7146C10.3845 4.7146 9.23341 5.06162 8.267 5.70859C7.30059 6.35557 6.56559 7.2712 6.16167 8.3313C5.75775 9.3914 5.70447 10.5447 6.00905 11.6347C6.31362 12.7248 6.96132 13.6988 7.8643 14.4248C6.45428 15.0347 5.23234 15.9818 4.31637 17.1748C4.14719 17.3954 4.07652 17.6711 4.11991 17.9415C4.16329 18.2118 4.31718 18.4546 4.54772 18.6164C4.77826 18.7783 5.06656 18.8459 5.3492 18.8044C5.63184 18.7629 5.88567 18.6157 6.05485 18.3952C6.68891 17.5668 7.51819 16.8931 8.4754 16.4288C9.4326 15.9644 10.4908 15.7224 11.5641 15.7224C12.6374 15.7224 13.6955 15.9644 14.6527 16.4288C15.6099 16.8931 16.4392 17.5668 17.0733 18.3952C17.2425 18.6158 17.4963 18.7631 17.7791 18.8047C18.0618 18.8462 18.3502 18.7787 18.5809 18.6169C18.8115 18.455 18.9655 18.2122 19.009 17.9418C19.0525 17.6713 18.9818 17.3955 18.8127 17.1748C17.8961 15.982 16.674 15.0349 15.2638 14.4248ZM7.97032 10.2191C7.97032 9.53919 8.18109 8.87458 8.57597 8.30929C8.97086 7.74399 9.53213 7.3034 10.1888 7.04322C10.8455 6.78305 11.5681 6.71497 12.2652 6.84761C12.9623 6.98025 13.6026 7.30764 14.1052 7.78838C14.6078 8.26912 14.9501 8.88163 15.0888 9.54844C15.2274 10.2152 15.1563 10.9064 14.8843 11.5345C14.6123 12.1627 14.1516 12.6995 13.5606 13.0772C12.9697 13.455 12.2748 13.6566 11.5641 13.6566C10.6109 13.6566 9.69686 13.2944 9.0229 12.6497C8.34894 12.0051 7.97032 11.1307 7.97032 10.2191ZM26.4871 18.6126C26.373 18.6928 26.2434 18.7507 26.1059 18.783C25.9683 18.8154 25.8255 18.8214 25.6855 18.8009C25.5455 18.7804 25.4111 18.7337 25.2899 18.6635C25.1688 18.5933 25.0633 18.5009 24.9795 18.3917C24.3439 17.565 23.5143 16.8925 22.5574 16.4283C21.6006 15.9641 20.5432 15.7212 19.4703 15.7191C19.1844 15.7191 18.9102 15.6104 18.708 15.417C18.5058 15.2236 18.3922 14.9613 18.3922 14.6878C18.3922 14.4143 18.5058 14.152 18.708 13.9586C18.9102 13.7652 19.1844 13.6566 19.4703 13.6566C19.9811 13.6557 20.4858 13.5507 20.9509 13.3485C21.4159 13.1464 21.8305 12.8517 22.1671 12.4842C22.5037 12.1167 22.7545 11.6848 22.9028 11.2172C23.0511 10.7497 23.0936 10.2573 23.0273 9.77281C22.9609 9.28836 22.7874 8.82299 22.5183 8.40774C22.2491 7.99248 21.8905 7.63688 21.4663 7.36464C21.0422 7.0924 20.5622 6.90977 20.0585 6.82894C19.5547 6.7481 19.0387 6.77092 18.5449 6.89586C18.407 6.93402 18.2625 6.94546 18.1199 6.92948C17.9773 6.91351 17.8395 6.87045 17.7145 6.80284C17.5895 6.73522 17.4799 6.64441 17.3922 6.53574C17.3044 6.42707 17.2402 6.30271 17.2033 6.16998C17.1665 6.03725 17.1577 5.89882 17.1775 5.7628C17.1973 5.62678 17.2454 5.49592 17.3188 5.3779C17.3922 5.25988 17.4895 5.15708 17.605 5.07552C17.7206 4.99396 17.8519 4.9353 17.9915 4.90297C19.2542 4.58294 20.5932 4.6837 21.7881 5.18868C22.9829 5.69366 23.9624 6.57275 24.5653 7.68123C25.1681 8.78971 25.3584 10.0615 25.1048 11.2872C24.8512 12.5129 24.1689 13.6195 23.1701 14.4248C24.5801 15.0347 25.802 15.9818 26.718 17.1748C26.886 17.395 26.956 17.6699 26.9127 17.9393C26.8694 18.2087 26.7164 18.4508 26.4871 18.6126Z" fill="currentColor"/>
    </g>
    <defs>
      <filter id="filter0_d_interview" x="0.107422" y="0.7146" width="30.8174" height="22.1021" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="BackgroundImageFix"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset/>
        <feGaussianBlur stdDeviation="2"/>
        <feComposite in2="hardAlpha" operator="out"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.15 0"/>
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_interview"/>
        <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_interview" result="shape"/>
      </filter>
    </defs>
  </svg>
); 